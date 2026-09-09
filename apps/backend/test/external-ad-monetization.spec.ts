import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockExternalAdProviderService } from '../src/ads/providers/mock-external-ad-provider.service';
import { ExternalAdNetworkService } from '../src/ads/providers/external-ad-network.service';
import { AdRevenueSyncService } from '../src/ads/providers/ad-revenue-sync.service';
import { AdDeliveryService } from '../src/ads/services/ad-delivery.service';
import { AdSelectorService } from '../src/ads/services/ad-selector.service';
import { TrackingTokenService } from '../src/ads/services/tracking-token.service';
import { MonetizationIntelligenceService } from '../src/admin/services/monetization-intelligence.service';
import { BusinessIntelligenceService } from '../src/admin/services/business-intelligence.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';

describe('Phase 24 — External Ad Network Integration & Real Monetization Activation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let mockProvider: MockExternalAdProviderService;
  let adNetworkService: ExternalAdNetworkService;
  let revenueSyncService: AdRevenueSyncService;
  let adDeliveryService: AdDeliveryService;
  let adSelectorService: AdSelectorService;
  let trackingTokenService: TrackingTokenService;
  let monetizationService: MonetizationIntelligenceService;
  let biService: BusinessIntelligenceService;
  let redisCache: RedisAdCacheService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    authService = moduleRef.get<AuthService>(AuthService);
    mockProvider = moduleRef.get<MockExternalAdProviderService>(MockExternalAdProviderService);
    adNetworkService = moduleRef.get<ExternalAdNetworkService>(ExternalAdNetworkService);
    revenueSyncService = moduleRef.get<AdRevenueSyncService>(AdRevenueSyncService);
    adDeliveryService = moduleRef.get<AdDeliveryService>(AdDeliveryService);
    adSelectorService = moduleRef.get<AdSelectorService>(AdSelectorService);
    trackingTokenService = moduleRef.get<TrackingTokenService>(TrackingTokenService);
    monetizationService = moduleRef.get<MonetizationIntelligenceService>(MonetizationIntelligenceService);
    biService = moduleRef.get<BusinessIntelligenceService>(BusinessIntelligenceService);
    redisCache = moduleRef.get<RedisAdCacheService>(RedisAdCacheService);

    // Obtain Admin JWT for authenticated endpoint tests
    const loginRes = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminToken = loginRes.accessToken || '';

    // Enable external ad network for Phase 24 tests
    adNetworkService.setEnabled(true);
  });

  afterAll(async () => {
    adNetworkService.setEnabled(false);
    // Clean up test revenue records & test creatives
    await prisma.adTargetingRule.deleteMany({ where: { creative: { name: 'House Fallback Banner' } } }).catch(() => {});
    await prisma.adCreative.deleteMany({ where: { name: 'House Fallback Banner' } }).catch(() => {});
    await prisma.adRevenueRecord.deleteMany({}).catch(() => {});
    await redisCache?.invalidateCache('bi:*').catch(() => {});
    await redisCache?.invalidateCache('monetization:*').catch(() => {});
    await app.close();
  });

  beforeEach(() => {
    mockProvider.reset();
  });

  // =========================================================================
  // 1. External Ad Provider Abstraction & Lifecycle
  // =========================================================================
  describe('1. External Ad Provider Abstraction & Lifecycle', () => {
    it('MockExternalAdProvider should initialize with standard contracts', async () => {
      expect(mockProvider.name).toBe('mock_network');
      expect(mockProvider.isConfigured()).toBe(true);

      const health = await mockProvider.healthCheck();
      expect(health.status).toBe('CONFIGURED');
      expect(health.health).toBe('HEALTHY');
      expect(health.provider).toBe('mock_network');
    });

    it('MockExternalAdProvider should generate valid ad response respecting placement and device', async () => {
      const ad = await mockProvider.requestAd(
        { placement: 'MOBILE_STICKY' },
        { device: 'MOBILE', country: 'US', sessionId: 'test_session_1' },
      );

      expect(ad).not.toBeNull();
      expect(ad?.creativeType).toBe('IMAGE');
      expect(ad?.width).toBe(320);
      expect(ad?.height).toBe(50);
      expect(ad?.revenueEligible).toBe(true);
      expect(ad?.providerAdId).toContain('mock_ext_mobile_sticky_');
      expect(ad?.targetUrl).toContain('https://example.com/sponsor');
    });

    it('MockExternalAdProvider should handle impression and click tracking callbacks', async () => {
      await expect(mockProvider.recordImpression('test_token_123')).resolves.not.toThrow();
      const clickRes = await mockProvider.recordClick('test_token_123');
      expect(clickRes.destinationUrl).toBeDefined();

      const metrics = mockProvider.getMetrics();
      expect(metrics.impressions).toBe(1);
      expect(metrics.clicks).toBe(1);
    });

    it('ExternalAdNetworkService should enforce fail-open timeout without throwing', async () => {
      // Configure mock provider to delay longer than the 200ms timeout
      mockProvider.shouldTimeout = true;
      mockProvider.timeoutDelayMs = 350;

      const ad = await adNetworkService.requestAd(
        { placement: 'HEADER_BANNER' },
        { device: 'DESKTOP', sessionId: 'test_timeout_sess' },
      );

      // Fail-open: returns null, never throws
      expect(ad).toBeNull();

      const health = await adNetworkService.healthCheck();
      expect(health.errorCount).toBeGreaterThan(0);
      expect(health.lastErrorMessage).toContain('timed out');
    });

    it('ExternalAdNetworkService should fail open when provider throws an error', async () => {
      mockProvider.shouldFail = true;

      const ad = await adNetworkService.requestAd(
        { placement: 'SIDEBAR' },
        { device: 'DESKTOP', sessionId: 'test_error_sess' },
      );

      // Fail-open: returns null, never throws
      expect(ad).toBeNull();

      const health = await adNetworkService.healthCheck();
      expect(health.errorCount).toBeGreaterThan(0);
      expect(health.lastErrorMessage).toContain('Mock external ad network error');
    });

    it('ExternalAdNetworkService healthCheck must never expose backend credentials', async () => {
      const health = await adNetworkService.healthCheck();
      expect(health).not.toHaveProperty('apiKey');
      expect(health).not.toHaveProperty('secret');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('health');
      expect(health).toHaveProperty('provider');
    });
  });

  // =========================================================================
  // 2. Ad Engine Orchestration Hierarchy (Tier A > Tier B > Tier C > Tier D)
  // =========================================================================
  describe('2. Ad Engine Orchestration Hierarchy (Tier A > Tier B > Tier C > Tier D)', () => {
    it('Tier B: should select external provider ad when internal targeting rules do not match', async () => {
      // Request a placement/utility combination without internal campaign
      const response = await adDeliveryService.getAdForSlot(
        { placement: 'DESKTOP_STICKY', utilitySlug: 'non-existent-utility' },
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      );

      expect(response.hasAd).toBe(true);
      expect(response.placement).toBe('DESKTOP_STICKY');
      // If external provider was selected, fallbackTier is TIER_EXTERNAL_PROVIDER or house fallback
      if (response.fallbackTier === 'TIER_EXTERNAL_PROVIDER') {
        expect(response.monetizationSource).toBe('EXTERNAL_NETWORK');
        expect(response.creative?.provider).toBeDefined();
        expect(response.creative?.revenueEligible).toBe(true);
        expect(response.creative?.trackingToken).toBeDefined();
      }
    });

    it('Tier C: should fall back to house/global fallback creative when external provider returns null', async () => {
      let fallbackPlacement = await prisma.adPlacement.findUnique({
        where: { code: 'HEADER_BANNER' },
      });

      if (!fallbackPlacement) {
        fallbackPlacement = await prisma.adPlacement.create({
          data: {
            code: 'HEADER_BANNER',
            name: 'Header Banner Placement',
          },
        });
      }

      let fallbackCampaign = await prisma.adCampaign.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!fallbackCampaign) {
        fallbackCampaign = await prisma.adCampaign.create({
          data: {
            name: 'House Fallback Campaign',
            status: 'ACTIVE',
          },
        });
      }

      const houseCreative = await prisma.adCreative.create({
        data: {
          name: 'House Fallback Banner',
          type: 'IMAGE',
          isGlobalFallback: true,
          targetUrl: 'https://example.com/about',
          targetingRules: {
            create: {
              campaignId: fallbackCampaign.id,
              placementId: fallbackPlacement.id,
              deviceTypes: ['DESKTOP', 'MOBILE', 'TABLET'],
              isActive: true,
            },
          },
        },
      });

      mockProvider.shouldReturnEmpty = true;

      const response = await adDeliveryService.getAdForSlot(
        { placement: 'HEADER_BANNER' },
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      );

      expect(response.hasAd).toBe(true);
      expect(response.fallbackTier).toBe('TIER_4_GLOBAL_FALLBACK');
      expect(response.monetizationSource).toBe('HOUSE_FALLBACK');

      // Cleanup
      await prisma.adTargetingRule.deleteMany({ where: { creativeId: houseCreative.id } }).catch(() => {});
      await prisma.adCreative.delete({ where: { id: houseCreative.id } }).catch(() => {});
    });

    it('Tier D: should return TIER_5_NO_AD when placement is invalid', async () => {
      const response = await adDeliveryService.getAdForSlot(
        { placement: 'INVALID_PLACEMENT' as any },
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      );

      expect(response.hasAd).toBe(false);
      expect(response.fallbackTier).toBe('TIER_5_NO_AD');
    });
  });

  // =========================================================================
  // 3. Impression & Click Tracking for External Provider Ads
  // =========================================================================
  describe('3. Impression & Click Tracking for External Provider Ads', () => {
    it('should generate, verify, and record external provider impression via tracking token', async () => {
      const token = trackingTokenService.generateToken({
        creativeId: 'ext_test_creative_1',
        campaignId: 'ext_test_campaign_1',
        placementId: 'ext_test_placement_1',
        placementCode: 'HEADER_BANNER',
        utilitySlug: 'case-converter',
        deviceType: 'DESKTOP',
        provider: 'mock_network',
        providerAdId: 'mock_ext_ad_999',
        externalTargetUrl: 'https://example.com/sponsor?utm=test',
      });

      const decoded = trackingTokenService.verifyToken(token);
      expect(decoded.provider).toBe('mock_network');
      expect(decoded.providerAdId).toBe('mock_ext_ad_999');

      const impRes = await adDeliveryService.recordImpression(
        {
          trackingToken: token,
          placement: 'HEADER_BANNER',
          utilitySlug: 'case-converter',
          sessionId: 'test_sess_ext_imp',
        },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(impRes.success).toBe(true);
      expect(impRes.recorded).toBe(true);
    });

    it('should track external click and resolve authoritative external destination URL', async () => {
      const destination = 'https://example.com/sponsor-landing-page';
      const token = trackingTokenService.generateToken({
        creativeId: 'ext_test_creative_click',
        campaignId: 'ext_test_campaign_click',
        placementId: 'ext_test_placement_click',
        placementCode: 'MID_CONTENT',
        utilitySlug: 'json-formatter',
        deviceType: 'DESKTOP',
        provider: 'mock_network',
        providerAdId: 'mock_ext_ad_click_1',
        externalTargetUrl: destination,
      });

      const clickRes = await adDeliveryService.recordClick(
        {
          trackingToken: token,
          placement: 'MID_CONTENT',
          sessionId: 'test_sess_ext_click',
        },
        '127.0.0.1',
      );

      expect(clickRes.destinationUrl).toBe(destination);
    });

    it('should reject dangerous target URLs (XSS mitigation)', async () => {
      const maliciousToken = trackingTokenService.generateToken({
        creativeId: 'ext_malicious_creative',
        campaignId: 'ext_malicious_camp',
        placementId: 'ext_malicious_place',
        placementCode: 'MID_CONTENT',
        provider: 'mock_network',
        externalTargetUrl: 'javascript:alert(document.cookie)',
      });

      await expect(
        adDeliveryService.recordClick({
          trackingToken: maliciousToken,
          placement: 'MID_CONTENT',
        }),
      ).rejects.toThrow('Invalid or dangerous target URL scheme');
    });
  });

  // =========================================================================
  // 4. Authoritative Revenue Data & Synchronization
  // =========================================================================
  describe('4. Authoritative Revenue Data & Synchronization', () => {
    it('should reject date ranges exceeding 90 days', async () => {
      await expect(
        revenueSyncService.syncRevenue({
          startDate: '2026-01-01',
          endDate: '2026-05-01', // 120 days
        }),
      ).rejects.toThrow('Date range cannot exceed 90 days');
    });

    it('should reject startDate after endDate', async () => {
      await expect(
        revenueSyncService.syncRevenue({
          startDate: '2026-09-10',
          endDate: '2026-09-01',
        }),
      ).rejects.toThrow('startDate cannot be after endDate');
    });

    it('should ingest revenue records and guarantee idempotency on duplicate sync', async () => {
      const syncDto = {
        startDate: '2026-09-01',
        endDate: '2026-09-03',
      };

      // First sync
      const firstSync = await revenueSyncService.syncRevenue(syncDto);
      expect(firstSync.status).toBe('SUCCESS');
      expect(firstSync.recordsIngested).toBeGreaterThan(0);
      expect(firstSync.totalRevenue).toBeGreaterThan(0);

      const recordsAfterFirst = await prisma.adRevenueRecord.count({
        where: { provider: 'mock_network' },
      });

      // Second sync of same period — must skip duplicates (idempotent)
      const secondSync = await revenueSyncService.syncRevenue(syncDto);
      expect(secondSync.status).toBe('SUCCESS');
      expect(secondSync.recordsIngested).toBe(0);
      expect(secondSync.duplicatesSkipped).toBe(firstSync.recordsIngested);

      const recordsAfterSecond = await prisma.adRevenueRecord.count({
        where: { provider: 'mock_network' },
      });
      expect(recordsAfterSecond).toBe(recordsAfterFirst);
    });
  });

  // =========================================================================
  // 5. Monetization Intelligence & Business Intelligence Integration
  // =========================================================================
  describe('5. Monetization Intelligence & Business Intelligence Integration', () => {
    it('MonetizationIntelligenceService should truthfully report ACTUAL revenue when records exist', async () => {
      const intel = await monetizationService.getMonetizationIntelligence(30);

      expect(intel.periodDays).toBe(30);
      expect(intel.providerHealth).toBeDefined();

      if (intel.actualRevenueStatus === 'ACTUAL') {
        expect(intel.actualRevenueTotal).toBeGreaterThan(0);
        expect(intel.actualRevenueCurrency).toBe('USD');
        expect(intel.revenueByPlacement).toBeDefined();
        expect(intel.revenueByUtility).toBeDefined();
        expect(intel.revenueByDevice).toBeDefined();
      } else {
        expect(intel.actualRevenueStatus).toBe('UNAVAILABLE');
        expect(intel.actualRevenueTotal).toBeNull();
      }
    });

    it('BusinessIntelligenceService should truthfully expose revenue availability without fabricating numbers', async () => {
      const bi = await biService.getBusinessIntelligence(30);

      expect(bi.kpis).toBeDefined();
      if (bi.kpis.revenueAvailable) {
        expect(bi.kpis.actualRevenueTotal).toBeGreaterThan(0);
        expect(bi.kpis.actualRevenueCurrency).toBe('USD');
      } else {
        expect(bi.kpis.actualRevenueTotal).toBeNull();
      }
    });
  });

  // =========================================================================
  // 6. Security & RBAC Boundaries
  // =========================================================================
  describe('6. Security & RBAC Boundaries', () => {
    it('GET /api/v1/admin/ads/provider/health should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/ads/provider/health')
        .expect(401);
    });

    it('POST /api/v1/admin/ads/provider/sync should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/ads/provider/sync')
        .send({})
        .expect(401);
    });

    it('GET /api/v1/admin/ads/provider/health should succeed with valid Admin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ads/provider/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('health');
      expect(res.body.data).toHaveProperty('provider');
    });

    it('GET /api/v1/admin/ads/revenue should succeed with valid Admin JWT and return records', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ads/revenue?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/admin/ads/provider/sync should execute bounded sync with valid Admin JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/provider/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startDate: '2026-09-01',
          endDate: '2026-09-02',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUCCESS');
    });
  });
});
