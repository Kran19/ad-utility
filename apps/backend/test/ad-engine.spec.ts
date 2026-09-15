import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AdDeliveryService } from '../src/ads/services/ad-delivery.service';
import { TrackingTokenService } from '../src/ads/services/tracking-token.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DeviceType } from '@ad-utility/shared';

jest.setTimeout(30000);

describe('Phase 5: Ad Engine, Deterministic Targeting, Rotation & Tracking Verification', () => {
  let app: INestApplication;
  let adDeliveryService: AdDeliveryService;
  let trackingTokenService: TrackingTokenService;
  let redisCacheService: RedisAdCacheService;
  let prisma: PrismaService;

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

    adDeliveryService = moduleFixture.get<AdDeliveryService>(AdDeliveryService);
    trackingTokenService = moduleFixture.get<TrackingTokenService>(TrackingTokenService);
    redisCacheService = moduleFixture.get<RedisAdCacheService>(RedisAdCacheService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Device-Specific Ad Selection (Mobile / Tablet / Desktop)', () => {
    it('should select Mobile creative (320x50) for MOBILE device on /json-formatter TOP_CONTENT', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'TOP_CONTENT',
        utilitySlug: 'json-formatter',
        categorySlug: 'developer',
        device: 'MOBILE',
      });

      expect(response.hasAd).toBe(true);
      expect(response.placement).toBe('TOP_CONTENT');
      expect(response.creative).toBeDefined();
      expect(response.creative?.altText).toBe('JSON Pro for Mobile');
      expect(response.creative?.width).toBe(320);
      expect(response.creative?.height).toBe(50);
      expect(response.fallbackTier).toBe('TIER_1_EXACT_UTILITY');
    });

    it('should select Tablet creative (468x60) for TABLET device on /json-formatter TOP_CONTENT', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'TOP_CONTENT',
        utilitySlug: 'json-formatter',
        categorySlug: 'developer',
        device: 'TABLET',
      });

      expect(response.hasAd).toBe(true);
      expect(response.creative?.altText).toBe('JSON Pro for Tablet');
      expect(response.creative?.width).toBe(468);
      expect(response.creative?.height).toBe(60);
    });

    it('should select Desktop creative (728x90) for DESKTOP device on /json-formatter TOP_CONTENT', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'TOP_CONTENT',
        utilitySlug: 'json-formatter',
        categorySlug: 'developer',
        device: 'DESKTOP',
      });

      expect(response.hasAd).toBe(true);
      expect(response.creative?.altText).toBe('JSON Pro for Desktop');
      expect(response.creative?.width).toBe(728);
      expect(response.creative?.height).toBe(90);
    });
  });

  describe('2. Targeting Precedence & Category Fallback', () => {
    it('should match category-targeted ad for tools under "developer" category (Tier 2)', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'HEADER_BANNER',
        utilitySlug: 'json-formatter',
        categorySlug: 'developer',
        device: 'DESKTOP',
      });

      expect(response.hasAd).toBe(true);
      expect(response.creative?.altText).toBe('Developer Tools Sponsor');
      expect(response.fallbackTier).toBe('TIER_2_CATEGORY');
    });

    it('should not match category-targeted ad for tools outside target category', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'HEADER_BANNER',
        utilitySlug: 'word-counter',
        categorySlug: 'text', // not developer
        device: 'DESKTOP',
      });

      // No category ad matches and no fallback exists for HEADER_BANNER on text tools
      expect(response.hasAd).toBe(false);
      expect(response.fallbackTier).toBe('TIER_5_NO_AD');
    });

    it('should return clean no-ad (hasAd: false) on tools without explicit assignment', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'AFTER_TOOL',
        utilitySlug: 'word-counter',
        categorySlug: 'text',
        device: 'DESKTOP',
      });

      expect(response.hasAd).toBe(false);
      expect(response.fallbackTier).toBe('TIER_5_NO_AD');
    });

    it('should match global fallback creative on general/global pages without utilitySlug (Tier 4)', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'AFTER_TOOL',
        device: 'DESKTOP',
      });

      expect(response.hasAd).toBe(true);
      expect(response.fallbackTier).toBe('TIER_4_GLOBAL_FALLBACK');
      expect(response.creative?.type).toBe('HTML');
      expect(response.creative?.customHtml).toContain('Global Platform Sponsor');
    });

    it('should return clean no-ad (hasAd: false) when placement has no matching candidates', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'DESKTOP_STICKY',
        utilitySlug: 'word-counter',
        device: 'DESKTOP',
      });

      expect(response.hasAd).toBe(false);
      expect(response.placement).toBe('DESKTOP_STICKY');
    });
  });

  describe('3. Signed Tracking Tokens & Impression / Click Flow', () => {
    let trackingToken: string;

    it('should return valid signed tracking token with delivered ad', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'TOP_CONTENT',
        utilitySlug: 'json-formatter',
        device: 'DESKTOP',
      });

      expect(response.creative?.trackingToken).toBeDefined();
      trackingToken = response.creative!.trackingToken;

      const decoded = trackingTokenService.verifyToken(trackingToken);
      expect(decoded.placementCode).toBe('TOP_CONTENT');
      expect(decoded.utilitySlug).toBe('json-formatter');
      expect(decoded.deviceType).toBe('DESKTOP');
    });

    it('POST /api/v1/ads/impression - should record impression with valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ads/impression')
        .send({
          trackingToken,
          placement: 'TOP_CONTENT',
          utilitySlug: 'json-formatter',
          device: 'DESKTOP',
          sessionId: 'test_session_123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recorded).toBe(true);
    });

    it('POST /api/v1/ads/impression - should fail safely on tampered token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ads/impression')
        .send({
          trackingToken: 'tampered.token.signature',
          placement: 'TOP_CONTENT',
        })
        .expect(200);

      expect(response.body.data.recorded).toBe(false);
    });

    it('POST /api/v1/ads/click - should record click and return authoritative destination URL', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ads/click')
        .send({
          trackingToken,
          placement: 'TOP_CONTENT',
          utilitySlug: 'json-formatter',
          device: 'DESKTOP',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.destinationUrl).toBe('https://example.com/json-pro-desktop');
    });

    it('POST /api/v1/ads/click - should reject dangerous javascript: URL schemes', async () => {
      // Temporarily create a creative with javascript: URL
      const dangerousCreative = await prisma.adCreative.create({
        data: {
          name: 'Dangerous XSS Creative',
          type: 'IMAGE',
          targetUrl: 'javascript:alert(1)',
        },
      });

      const dangerousToken = trackingTokenService.generateToken({
        creativeId: dangerousCreative.id,
        campaignId: 'dummy_campaign',
        placementId: 'dummy_placement',
        placementCode: 'TOP_CONTENT',
      });

      await request(app.getHttpServer())
        .post('/api/v1/ads/click')
        .send({ trackingToken: dangerousToken })
        .expect(400);

      // Cleanup
      await prisma.adCreative.delete({ where: { id: dangerousCreative.id } });
    });
  });

  describe('4. Fault-Tolerance & Non-Blocking Resilience', () => {
    it('should degrade cleanly and return no-ad on database or selector errors', async () => {
      const response = await adDeliveryService.getAdForSlot({
        placement: 'INVALID_PLACEMENT' as any,
      });

      expect(response.hasAd).toBe(false);
    });
  });
});
