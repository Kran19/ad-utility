import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

jest.setTimeout(30000);

describe('Phase 12: Production Readiness, Probes & Observability', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable shutdown hooks
    app.enableShutdownHooks();

    // Disable X-Powered-By
    app.getHttpAdapter().getInstance().disable('x-powered-by');

    // Request Correlation Middleware
    app.use(new RequestIdMiddleware().use);

    // Security Headers
    app.use((_req: any, res: any, next: () => void) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    app.use(cookieParser());
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
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. HEALTH CHECKS: LIVENESS & READINESS
  // =========================================================================
  describe('1. Health Checks & Container Probes', () => {
    it('should return 200 on /health legacy endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.service).toBe('ad-utility-backend');
    });

    it('should return 200 on /health/liveness indicating process vitality', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/liveness')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('alive');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
    });

    it('should return 200 on /health/readiness when database is connected', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/readiness')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.database).toBe('connected');
    });

    it('should return 503 on /health/readiness when database query fails', async () => {
      // Temporarily mock $queryRaw to simulate database loss
      jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection lost to PostgreSQL'));

      const res = await request(app.getHttpServer())
        .get('/api/v1/health/readiness')
        .expect(503);

      expect(res.body.statusCode).toBe(503);
      expect(res.body.message).toMatch(/database connection failed/i);
      expect(res.body.error).toMatch(/Service\s*Unavailable/i);

      jest.restoreAllMocks();
    });
  });

  // =========================================================================
  // 2. REQUEST CORRELATION & TRACEABILITY
  // =========================================================================
  describe('2. Request Correlation & Tracing Headers', () => {
    it('should automatically assign a UUID X-Request-Id header when not provided by caller', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should preserve and echo caller-provided X-Request-Id header', async () => {
      const customTraceId = 'external-trace-id-abc-12345';
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('X-Request-Id', customTraceId)
        .expect(200);

      expect(res.headers['x-request-id']).toBe(customTraceId);
    });
  });

  // =========================================================================
  // 3. SECURITY & COOKIE SCOPING
  // =========================================================================
  describe('3. Production Cookie Security & Attributes', () => {
    it('should set HttpOnly and SameSite=Lax on authentication login cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@adplatform.local',
          password: 'AdminSecurePassword123!',
        })
        .expect(200);

      const rawCookies = res.headers['set-cookie'];
      expect(rawCookies).toBeDefined();

      const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : [rawCookies as string];
      const accessCookie = cookies.find((c: string) => c.startsWith('accessToken='));
      const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));

      expect(accessCookie).toBeDefined();
      expect(accessCookie).toMatch(/httponly/i);
      expect(accessCookie).toMatch(/samesite=lax/i);

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/httponly/i);
      expect(refreshCookie).toMatch(/samesite=lax/i);
    });
  });

  // =========================================================================
  // 4. AI INTEGRATION DEFERRAL INTEGRITY
  // =========================================================================
  describe('4. AI Deferral Constraint Integrity', () => {
    it('should operate mock AI execution without OPENAI_API_KEY present', async () => {
      // Ensure OPENAI_API_KEY is unset in test
      delete process.env.OPENAI_API_KEY;

      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/ai-humanizer/execute')
        .send({
          input: {
            text: 'This is an input sentence that requires humanization.',
            tone: 'conversational',
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.result.humanizedText).toBeDefined();
      expect(res.body.data.mode).toBe('AI');
    });
  });
});
