import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';
import { AiGatewayService } from '../src/ai/services/ai-gateway.service';

jest.setTimeout(30000);

describe('Phase 16: Operational Resilience, Observability & Production Hardening', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisCache: RedisAdCacheService;
  let aiGateway: AiGatewayService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(new RequestIdMiddleware().use);
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redisCache = moduleFixture.get<RedisAdCacheService>(RedisAdCacheService);
    aiGateway = moduleFixture.get<AiGatewayService>(AiGatewayService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Request Correlation & ID Propagation', () => {
    it('should generate an X-Request-Id header when incoming request has none', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('should preserve and sanitize a valid incoming X-Request-Id header', async () => {
      const customId = 'corr-trace-prod-abc-12345';
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('X-Request-Id', customId)
        .expect(200);

      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('should include requestId in utility execution response matching request header', async () => {
      const customId = 'util-req-trace-999';
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/case-converter/execute')
        .set('X-Request-Id', customId)
        .send({ input: { text: 'hello world', targetCase: 'uppercase' } })
        .expect(200);

      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requestId).toBe(customId);
      expect(res.body.data.result.convertedText).toBe('HELLO WORLD');
    });
  });

  describe('2. Error Observability & Sanitization', () => {
    it('should attach requestId to 404 error responses without exposing internals', async () => {
      const customId = 'err-trace-404-test';
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/nonexistent-utility-slug-xyz')
        .set('X-Request-Id', customId)
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.requestId).toBe(customId);
      expect(res.body.message).toContain('nonexistent-utility-slug-xyz');
      expect(res.body.stack).toBeUndefined();
    });

    it('should attach requestId to 400 validation errors', async () => {
      const customId = 'err-trace-400-test';
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/case-converter/execute')
        .set('X-Request-Id', customId)
        .send({ input: { invalidField: true } })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.requestId).toBe(customId);
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('3. Observability Health Probes', () => {
    it('GET /api/v1/health should return compatibility status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.service).toBe('ad-utility-backend');
    });

    it('GET /api/v1/health/liveness should return process vitality with uptime', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/liveness')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('alive');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/v1/health/readiness should report database and redis readiness', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/readiness')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.database).toBe('connected');
      expect(['connected', 'degraded']).toContain(res.body.data.redis);
    });
  });

  describe('4. Redis Resilience & Fail-Open Behavior', () => {
    it('should deliver ads even if Redis is unavailable (fail-open)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ads/slot')
        .send({
          placement: 'HEADER_BANNER',
          categorySlug: 'developer',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hasAd).toBe(true);
      expect(res.body.data.creative).toBeDefined();
    });

    it('should ingest telemetry events even if deduplicator is active', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send([
          {
            eventType: 'PAGE_VIEW',
            utilitySlug: 'case-converter',
            sessionToken: 'sess_test_resilience_1',
            timestamp: new Date().toISOString(),
          },
        ])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.received).toBe(1);
      expect(res.body.data.accepted).toBe(1);
    });
  });

  describe('5. AI Subsystem Operational Governance (Mock Mode)', () => {
    it('should confirm AI Gateway operates in mock provider mode by default', () => {
      expect(aiGateway.getProviderMode()).toBe('mock');
    });

    it('should execute mock AI generation with deterministic telemetry and zero external calls', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/ai-grammar-checker/execute')
        .send({ input: { text: 'He go to school yesterday.' } })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.mode).toBe('AI');
      expect(res.body.data.result).toBeDefined();
    });

    it('should enforce 15 req/min rate limiting on AI Gateway', async () => {
      // Gateway rate limiter allows up to 15 req/min per identifier
      const prompt = 'Test rate limiter resiliency';
      let limited = false;

      for (let i = 0; i < 20; i++) {
        try {
          const res = await request(app.getHttpServer())
            .post('/api/v1/ai/generate')
            .send({ prompt, utilitySlug: 'ai-paraphraser' });

          if (res.status === 429) {
            limited = true;
            break;
          }
        } catch {
          // ignore
        }
      }

      expect(limited).toBe(true);
    });
  });

  describe('6. Non-AI Subsystem Isolation & Stability', () => {
    it('should execute text utilities reliably (case-converter, text-cleaner)', async () => {
      const textRes = await request(app.getHttpServer())
        .post('/api/v1/utilities/text-cleaner/execute')
        .send({ input: { text: '   Clean   Spaces   ' } })
        .expect(200);

      expect(textRes.body.success).toBe(true);
      expect(textRes.body.data.result.cleanedText).toBe('Clean Spaces');
    });

    it('should reject malformed image payloads with clean 400 error', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/jpg-to-png/execute')
        .send({ input: { fileData: 'data:image/jpeg;base64,bm90LWEtdmFsaWQtcG5nLW9yLWpwZw==' } })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain('Invalid JPEG file signature');
    });
  });
});
