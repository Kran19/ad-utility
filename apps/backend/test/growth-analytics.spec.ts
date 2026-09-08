import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30000);

describe('Phase 14: Growth, Conversion & Monetization Analytics Verification', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;
  let adminToken: string;

  const testSessionToken = `phase14-test-session-${Date.now()}`;

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

    authService = moduleFixture.get<AuthService>(AuthService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    const login = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminToken = login.accessToken;
  });

  afterAll(async () => {
    // Clean up test events
    await prisma.analyticsEvent.deleteMany({
      where: { sessionToken: testSessionToken },
    });
    await prisma.utility.deleteMany({
      where: { slug: { startsWith: 'test-tool-' } },
    });
    await app.close();
  });

  describe('1. Ingestion of RESULT_DOWNLOAD and Funnel Telemetry', () => {
    it('POST /api/v1/analytics/events - should accept RESULT_DOWNLOAD event type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventType: 'RESULT_DOWNLOAD',
          utilitySlug: 'pdf-merge',
          sessionToken: testSessionToken,
          metadata: { filename: 'merged.pdf', sizeBytes: 10240 },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accepted).toBe(1);
    });

    it('POST /api/v1/analytics/events - should accept batch funnel events with UTM data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          events: [
            {
              eventType: 'PAGE_VIEW',
              utilitySlug: 'jpg-to-png',
              sessionToken: testSessionToken,
              utmSource: 'google',
              utmMedium: 'cpc',
              utmCampaign: 'seo_boost',
            },
            {
              eventType: 'TOOL_START',
              utilitySlug: 'jpg-to-png',
              sessionToken: testSessionToken,
              utmSource: 'google',
            },
            {
              eventType: 'TOOL_COMPLETE',
              utilitySlug: 'jpg-to-png',
              sessionToken: testSessionToken,
              metadata: { executionTimeMs: 45 },
            },
            {
              eventType: 'RESULT_DOWNLOAD',
              utilitySlug: 'jpg-to-png',
              sessionToken: testSessionToken,
              metadata: { filename: 'converted.png' },
            },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accepted).toBe(4);
    });
  });

  describe('2. Admin Growth Analytics Overview & Funnel Math', () => {
    it('GET /api/v1/admin/analytics/overview - should return conversion funnel and placement metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/overview?days=7')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const data = response.body.data;

      // Validate Funnel Structure
      expect(data.funnel).toBeDefined();
      expect(typeof data.funnel.pageViews).toBe('number');
      expect(typeof data.funnel.toolStarts).toBe('number');
      expect(typeof data.funnel.toolCompletions).toBe('number');
      expect(typeof data.funnel.resultDownloads).toBe('number');
      expect(typeof data.funnel.viewToStartRate).toBe('number');
      expect(typeof data.funnel.startToCompleteRate).toBe('number');
      expect(typeof data.funnel.completeToDownloadRate).toBe('number');
      expect(typeof data.funnel.overallConversionRate).toBe('number');

      // No NaN or Infinity
      expect(Number.isFinite(data.funnel.viewToStartRate)).toBe(true);
      expect(Number.isFinite(data.funnel.startToCompleteRate)).toBe(true);
      expect(Number.isFinite(data.funnel.completeToDownloadRate)).toBe(true);
      expect(Number.isFinite(data.funnel.overallConversionRate)).toBe(true);

      // Validate Placement Performance
      expect(Array.isArray(data.placementPerformance)).toBe(true);
      for (const placement of data.placementPerformance) {
        expect(placement.placementCode).toBeDefined();
        expect(typeof placement.impressions).toBe('number');
        expect(typeof placement.clicks).toBe('number');
        expect(typeof placement.ctr).toBe('number');
        expect(Number.isFinite(placement.ctr)).toBe(true);
      }

      // Validate Acquisition
      expect(Array.isArray(data.acquisition)).toBe(true);
    });
  });

  describe('3. Related Utilities Internal Linking', () => {
    it('GET /api/v1/utilities/jpg-to-png - should return deterministic related utilities', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/utilities/jpg-to-png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.relatedSlugs)).toBe(true);
      expect(response.body.data.relatedSlugs).toContain('png-to-jpg');
      expect(response.body.data.relatedSlugs).toContain('image-compressor');
    });

    it('GET /api/v1/utilities/pdf-merge - should return related PDF tools', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/utilities/pdf-merge')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.relatedSlugs)).toBe(true);
      expect(response.body.data.relatedSlugs).toContain('pdf-split');
      expect(response.body.data.relatedSlugs).toContain('pdf-compressor');
    });

    it('GET /api/v1/utilities/text-cleaner - should return related text tools', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/utilities/text-cleaner')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.relatedSlugs)).toBe(true);
      expect(response.body.data.relatedSlugs).toContain('case-converter');
    });
  });

  describe('4. Zero-Data State Safety', () => {
    it('GET /api/v1/admin/analytics/overview?days=90 - should return finite numbers even with empty or low data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/overview?days=90')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Number.isFinite(response.body.data.funnel.viewToStartRate)).toBe(true);
      expect(Number.isFinite(response.body.data.funnel.startToCompleteRate)).toBe(true);
      expect(Number.isFinite(response.body.data.funnel.completeToDownloadRate)).toBe(true);
      expect(Number.isFinite(response.body.data.funnel.overallConversionRate)).toBe(true);
    });
  });
});

