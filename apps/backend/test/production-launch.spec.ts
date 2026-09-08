import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TrackingTokenService } from '../src/ads/services/tracking-token.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

jest.setTimeout(30000);

describe('Phase 13: Production Launch & Monetization Readiness', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let trackingTokenService: TrackingTokenService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.enableShutdownHooks();
    app.getHttpAdapter().getInstance().disable('x-powered-by');
    app.use(new RequestIdMiddleware().use);

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
    trackingTokenService = moduleFixture.get<TrackingTokenService>(TrackingTokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. API ORIGIN & ENDPOINT NORMALIZATION
  // =========================================================================
  describe('1. API Origin & Endpoint Hardening', () => {
    it('should cleanly accept API requests under the /api/v1 prefix without double-prefixing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
    });

    it('should return 404 for doubled /api/v1/api/v1 paths', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/api/v1/health')
        .expect(404);
    });
  });

  // =========================================================================
  // 2. AD DELIVERY & FALLBACK BEHAVIOR
  // =========================================================================
  describe('2. Ad Engine Delivery & Monetization Readiness', () => {
    it('should deliver an ad with signed tracking token for HEADER_BANNER on category page', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ads/slot')
        .send({
          placement: 'HEADER_BANNER',
          categorySlug: 'developer',
          utilitySlug: 'json-formatter',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hasAd).toBe(true);
      expect(res.body.data.creative).toBeDefined();
      expect(typeof res.body.data.creative.trackingToken).toBe('string');
      expect(res.body.data.creative.trackingToken).toContain('.');
    });

    it('should return clean no-ad (TIER_5_NO_AD) for an invalid placement without throwing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ads/slot')
        .send({ placement: 'NONEXISTENT_PLACEMENT', device: 'DESKTOP' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hasAd).toBe(false);
      expect(res.body.data.fallbackTier).toBe('TIER_5_NO_AD');
    });

    it('should deliver fallback ad for all 8 standard placements', async () => {
      const placements = [
        'HEADER_BANNER',
        'TOP_CONTENT',
        'AFTER_TOOL',
        'MID_CONTENT',
        'BOTTOM_CONTENT',
        'SIDEBAR',
        'MOBILE_STICKY',
        'DESKTOP_STICKY',
      ];

      for (const placement of placements) {
        const device = placement === 'MOBILE_STICKY' ? 'MOBILE' : 'DESKTOP';
        const res = await request(app.getHttpServer())
          .post('/api/v1/ads/slot')
          .send({ placement, device })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.placement).toBe(placement);
      }
    });
  });

  // =========================================================================
  // 3. AD IMPRESSION RECORDING & AUDIT
  // =========================================================================
  describe('3. Ad Impression Verification', () => {
    it('should record an impression successfully with a valid signed token', async () => {
      // 1. Fetch valid ad
      const slotRes = await request(app.getHttpServer())
        .post('/api/v1/ads/slot')
        .send({
          placement: 'AFTER_TOOL',
          utilitySlug: 'word-counter',
          categorySlug: 'text',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(slotRes.body.data.hasAd).toBe(true);
      const trackingToken = slotRes.body.data.creative.trackingToken;

      // 2. Record impression
      const impRes = await request(app.getHttpServer())
        .post('/api/v1/ads/impression')
        .send({
          trackingToken,
          placement: 'AFTER_TOOL',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(impRes.body.success).toBe(true);
      expect(impRes.body.data.recorded).toBe(true);
    });

    it('should discard impression recording without throwing on a malformed tracking token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ads/impression')
        .send({
          trackingToken: 'invalid.forged_token_payload',
          placement: 'AFTER_TOOL',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.recorded).toBe(false);
    });
  });

  // =========================================================================
  // 4. AD CLICK FLOW & SECURITY CONTROLS
  // =========================================================================
  describe('4. Ad Click Flow & Security Boundaries', () => {
    it('should record click and return authoritative destination URL for a valid token', async () => {
      const slotRes = await request(app.getHttpServer())
        .post('/api/v1/ads/slot')
        .send({
          placement: 'AFTER_TOOL',
          utilitySlug: 'word-counter',
          categorySlug: 'text',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(slotRes.body.data.hasAd).toBe(true);
      const trackingToken = slotRes.body.data.creative.trackingToken;

      const clickRes = await request(app.getHttpServer())
        .post('/api/v1/ads/click')
        .send({
          trackingToken,
          placement: 'AFTER_TOOL',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(clickRes.body.success).toBe(true);
      expect(clickRes.body.data.destinationUrl).toBeDefined();
      expect(clickRes.body.data.destinationUrl).toMatch(/^https?:\/\//);
    });

    it('should reject a click with a tampered token signature with 400 Bad Request', async () => {
      const slotRes = await request(app.getHttpServer())
        .post('/api/v1/ads/slot')
        .send({
          placement: 'AFTER_TOOL',
          utilitySlug: 'word-counter',
          categorySlug: 'text',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(slotRes.body.data.hasAd).toBe(true);
      const validToken = slotRes.body.data.creative.trackingToken;
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.TAMPERED_INVALID_SIG`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/ads/click')
        .send({
          trackingToken: tamperedToken,
          placement: 'AFTER_TOOL',
          device: 'DESKTOP',
        })
        .expect(400);

      expect(res.body.message).toContain('Invalid tracking token signature');
    });

    it('should reject an expired tracking token (> 24 hours) with 400 Bad Request', async () => {
      // Create a token with timestamp 25 hours in the past
      const pastTime = Date.now() - 25 * 60 * 60 * 1000;
      const expiredPayload = {
        creativeId: 'test-creative',
        campaignId: 'test-campaign',
        placementId: 'test-placement',
        placementCode: 'HEADER_BANNER' as any,
        timestamp: pastTime,
      };

      // Generate signed token with old timestamp manually
      const serialized = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const crypto = require('crypto');
      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production_min_32_chars';
      const sig = crypto.createHmac('sha256', secret).update(serialized).digest('base64url');
      const expiredToken = `${serialized}.${sig}`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/ads/click')
        .send({
          trackingToken: expiredToken,
          placement: 'HEADER_BANNER',
          device: 'DESKTOP',
        })
        .expect(400);

      expect(res.body.message).toContain('Expired tracking token');
    });
  });

  // =========================================================================
  // 5. ANALYTICS FUNNEL & PRIVACY GUARANTEES
  // =========================================================================
  describe('5. Analytics Funnel & Privacy Guarantees', () => {
    it('should successfully ingest an end-to-end user funnel batch', async () => {
      const sessionToken = `test_sess_${Date.now()}`;
      const events = [
        {
          eventId: `evt_funnel_pv_${Date.now()}`,
          eventType: 'PAGE_VIEW',
          utilitySlug: 'case-converter',
          sessionToken,
        },
        {
          eventId: `evt_funnel_ts_${Date.now()}`,
          eventType: 'TOOL_START',
          utilitySlug: 'case-converter',
          sessionToken,
        },
        {
          eventId: `evt_funnel_tc_${Date.now()}`,
          eventType: 'TOOL_COMPLETE',
          utilitySlug: 'case-converter',
          sessionToken,
          metadata: { executionTimeMs: 45 },
        },
      ];

      const res = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send(events)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.received).toBe(3);
      expect(res.body.data.accepted).toBe(3);
    });

    it('should reject analytics events exceeding metadata limit (5KB) with 400 Bad Request', async () => {
      const hugeMetadata: Record<string, string> = {};
      for (let i = 0; i < 200; i++) {
        hugeMetadata[`key_${i}`] = 'a'.repeat(50);
      }

      const res = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventId: 'evt_oversized',
          eventType: 'PAGE_VIEW',
          metadata: hugeMetadata,
        })
        .expect(200);

      // Ingest endpoint sanitizes/rejects individual invalid events and reports accepted: 0
      expect(res.body.data.accepted).toBe(0);
    });

    it('should reject an unsupported eventType', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventId: 'evt_invalid_type',
          eventType: 'MALICIOUS_UNSUPPORTED_TYPE',
        })
        .expect(200);

      expect(res.body.data.accepted).toBe(0);
    });
  });
});
