import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AnalyticsService } from '../src/analytics/services/analytics.service';
import { AnalyticsValidationService } from '../src/analytics/services/analytics-validation.service';
import { AnalyticsDeduplicationService } from '../src/analytics/services/analytics-deduplication.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

jest.setTimeout(30000);

describe('Phase 7: First-Party Analytics Engine & Telemetry Verification', () => {
  let app: INestApplication;
  let analyticsService: AnalyticsService;
  let validationService: AnalyticsValidationService;
  let deduplicationService: AnalyticsDeduplicationService;
  let prisma: PrismaService;
  let authService: AuthService;
  let adminAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    analyticsService = moduleFixture.get<AnalyticsService>(AnalyticsService);
    validationService = moduleFixture.get<AnalyticsValidationService>(AnalyticsValidationService);
    deduplicationService = moduleFixture.get<AnalyticsDeduplicationService>(AnalyticsDeduplicationService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    const loginResult = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminAccessToken = loginResult.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Event Ingestion (Single & Batch)', () => {
    it('should ingest valid PAGE_VIEW and TOOL lifecycle events', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          events: [
            {
              eventType: 'PAGE_VIEW',
              utilitySlug: 'json-formatter',
              sessionToken: 'test_sess_001',
              utmSource: 'google',
              utmMedium: 'cpc',
              utmCampaign: 'dev_tools',
            },
            {
              eventType: 'TOOL_START',
              utilitySlug: 'json-formatter',
              sessionToken: 'test_sess_001',
            },
            {
              eventType: 'TOOL_COMPLETE',
              utilitySlug: 'json-formatter',
              sessionToken: 'test_sess_001',
              metadata: { executionTimeMs: 45 },
            },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.received).toBe(3);
      expect(response.body.data.accepted).toBe(3);
      expect(response.body.data.duplicates).toBe(0);
    });

    it('should accept single event payload format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventType: 'TOOL_ERROR',
          utilitySlug: 'json-formatter',
          sessionToken: 'test_sess_001',
          metadata: { errorMessage: 'Invalid syntax' },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accepted).toBe(1);
    });
  });

  describe('2. Validation & Sanitization', () => {
    it('should reject invalid event types', () => {
      expect(() => {
        validationService.validateAndSanitizeEvent({ eventType: 'INVALID_UNKNOWN_EVENT' });
      }).toThrow();
    });

    it('should sanitize oversized UTM and metadata payloads', () => {
      const oversizedUtm = 'a'.repeat(200);
      const sanitized = validationService.validateAndSanitizeEvent({
        eventType: 'PAGE_VIEW',
        utmSource: oversizedUtm,
      });

      expect(sanitized.utmSource?.length).toBeLessThanOrEqual(100);
    });

    it('should reject metadata exceeding 5KB limit', () => {
      const hugeMetadata = { data: 'x'.repeat(6000) };
      expect(() => {
        validationService.validateAndSanitizeEvent({
          eventType: 'PAGE_VIEW',
          metadata: hugeMetadata,
        });
      }).toThrow();
    });
  });

  describe('3. Event Deduplication', () => {
    it('should detect duplicate eventId submissions within window', async () => {
      const uniqueEventId = 'evt_test_dedup_' + Date.now();

      // First submission
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventId: uniqueEventId,
          eventType: 'PAGE_VIEW',
          utilitySlug: 'word-counter',
        })
        .expect(200);

      expect(res1.body.data.accepted).toBe(1);
      expect(res1.body.data.duplicates).toBe(0);

      // Duplicate submission
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventId: uniqueEventId,
          eventType: 'PAGE_VIEW',
          utilitySlug: 'word-counter',
        })
        .expect(200);

      expect(res2.body.data.accepted).toBe(0);
      expect(res2.body.data.duplicates).toBe(1);
    });
  });

  describe('4. Reporting & RBAC Summary Endpoint', () => {
    it('GET /api/v1/analytics/summary - should require authentication (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .expect(401);
    });

    it('GET /api/v1/analytics/summary - should return aggregated platform telemetry for Admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalEvents).toBeGreaterThanOrEqual(1);
      expect(response.body.data.totalPageViews).toBeGreaterThanOrEqual(1);
      expect(response.body.data.toolCompletionRate).toBeDefined();
      expect(response.body.data.breakdownByUtility).toBeDefined();
    });
  });
});
