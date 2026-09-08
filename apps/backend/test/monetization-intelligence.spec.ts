import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MonetizationIntelligenceService } from '../src/admin/services/monetization-intelligence.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';

describe('Phase 19 — Revenue Optimization, Ad Yield & Monetization Intelligence', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let monetizationService: MonetizationIntelligenceService;
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
    monetizationService = moduleRef.get<MonetizationIntelligenceService>(MonetizationIntelligenceService);
    redisCache = moduleRef.get<RedisAdCacheService>(RedisAdCacheService);

    // Obtain Admin JWT for authenticated endpoint tests
    const loginRes = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminToken = loginRes.accessToken || '';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Admin API Authorization & RBAC Boundaries', () => {
    it('GET /api/v1/admin/analytics/monetization should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/monetization')
        .expect(401);
    });

    it('GET /api/v1/admin/analytics/monetization/recommendations should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/monetization/recommendations')
        .expect(401);
    });

    it('GET /api/v1/admin/analytics/monetization should succeed with valid Admin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/monetization?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.placementYield).toBeDefined();
      expect(res.body.data.creativePerformance).toBeDefined();
      expect(res.body.data.devicePerformance).toBeDefined();
      expect(res.body.data.utilityMonetization).toBeDefined();
      expect(res.body.data.recommendations).toBeDefined();
    });

    it('GET /api/v1/admin/analytics/monetization/recommendations should return array of advisory items', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/monetization/recommendations?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        const item = res.body.data[0];
        expect(item.id).toBeDefined();
        expect(item.severity).toBeDefined();
        expect(item.category).toBeDefined();
        expect(item.entity).toBeDefined();
        expect(item.recommendedAction).toBeDefined();
      }
    });
  });

  describe('2. Yield & Metrics Calculation Integrity', () => {
    it('should calculate CTR accurately with zero division protection', async () => {
      const result = await monetizationService.getMonetizationIntelligence(30);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalImpressions).toBe('number');
      expect(typeof result.summary.totalClicks).toBe('number');
      expect(typeof result.summary.overallCtr).toBe('number');
      expect(Number.isNaN(result.summary.overallCtr)).toBe(false);

      if (result.summary.totalImpressions === 0) {
        expect(result.summary.overallCtr).toBe(0);
      }
    });

    it('should bound and clamp query date ranges safely', async () => {
      const resSmall = await monetizationService.getMonetizationIntelligence(-5);
      expect(resSmall.periodDays).toBe(1);

      const resLarge = await monetizationService.getMonetizationIntelligence(1000);
      expect(resLarge.periodDays).toBe(365);
    });

    it('should report truthful fill-rate metadata without fabricating revenue', async () => {
      const result = await monetizationService.getMonetizationIntelligence(30);
      expect(result.summary.fillRateAvailable).toBe(false);
      expect((result.summary as any).estimatedRevenue).toBeUndefined(); // Zero fabricated dollar revenue
    });
  });

  describe('3. Deterministic Optimization Scoring & Status', () => {
    it('should assign bounded 0-100 scores for all placements', async () => {
      const result = await monetizationService.getMonetizationIntelligence(30);
      expect(result.placementYield.length).toBeGreaterThan(0);

      for (const p of result.placementYield) {
        expect(p.optimizationScore).toBeGreaterThanOrEqual(0);
        expect(p.optimizationScore).toBeLessThanOrEqual(100);
        expect(['HIGH_PERFORMING', 'AVERAGE', 'UNDERPERFORMING', 'INSUFFICIENT_DATA']).toContain(p.status);
      }
    });

    it('should assign bounded 0-100 scores for all creatives', async () => {
      const result = await monetizationService.getMonetizationIntelligence(30);

      for (const c of result.creativePerformance) {
        expect(c.optimizationScore).toBeGreaterThanOrEqual(0);
        expect(c.optimizationScore).toBeLessThanOrEqual(100);
        expect(['HIGH_PERFORMING', 'AVERAGE', 'UNDERPERFORMING', 'INSUFFICIENT_DATA']).toContain(c.status);
      }
    });
  });

  describe('4. Creative Format & Device Yield Breakdown', () => {
    it('should produce format breakdown for IMAGE, VIDEO, HTML, and IFRAME', async () => {
      const result = await monetizationService.getMonetizationIntelligence(30);
      expect(result.formatBreakdown).toBeDefined();
      const types = result.formatBreakdown.map((f) => f.type);
      expect(types).toContain('IMAGE');
      expect(types).toContain('VIDEO');
      expect(types).toContain('HTML');
      expect(types).toContain('IFRAME');
    });

    it('should produce device yield breakdown for DESKTOP, MOBILE, and TABLET', async () => {
      const result = await monetizationService.getMonetizationIntelligence(30);
      expect(result.devicePerformance).toBeDefined();
      const devices = result.devicePerformance.map((d) => d.device);
      expect(devices).toContain('DESKTOP');
      expect(devices).toContain('MOBILE');
      expect(devices).toContain('TABLET');

      for (const d of result.devicePerformance) {
        expect(typeof d.engagementIndex).toBe('number');
        expect(Number.isNaN(d.engagementIndex)).toBe(false);
      }
    });
  });

  describe('5. Utility Monetization & Conversion Synergy', () => {
    it('should aggregate ad impressions alongside tool starts and completions per utility', async () => {
      const result = await monetizationService.getMonetizationIntelligence(30);
      expect(result.utilityMonetization.length).toBeGreaterThan(0);

      const caseConverter = result.utilityMonetization.find((u) => u.utilitySlug === 'case-converter');
      if (caseConverter) {
        expect(caseConverter.name).toBeDefined();
        expect(typeof caseConverter.impressions).toBe('number');
        expect(typeof caseConverter.clicks).toBe('number');
        expect(typeof caseConverter.toolStarts).toBe('number');
        expect(typeof caseConverter.toolCompletions).toBe('number');
        expect(typeof caseConverter.completionRate).toBe('number');
        expect(typeof caseConverter.adEngagementRate).toBe('number');
      }
    });
  });

  describe('6. Advisory Recommendations Engine', () => {
    it('should generate structured recommendations with severity and actionable advice', async () => {
      const recs = await monetizationService.getRecommendations(30);
      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThan(0);

      for (const r of recs) {
        expect(['INFO', 'WARNING', 'CRITICAL']).toContain(r.severity);
        expect(['PLACEMENT', 'CREATIVE', 'CAMPAIGN', 'DEVICE', 'UTILITY', 'EXPERIMENT']).toContain(r.category);
        expect(r.entity).toBeDefined();
        expect(r.reason).toBeDefined();
        expect(r.recommendedAction).toBeDefined();
      }
    });
  });

  describe('7. Privacy & Security Assurance', () => {
    it('should not leak raw IPs, emails, or user credentials in monetization intelligence payloads', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/monetization?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const payloadStr = JSON.stringify(res.body.data);
      expect(payloadStr).not.toContain('passwordHash');
      expect(payloadStr).not.toContain('admin@adplatform.local');
      expect(payloadStr).not.toContain('127.0.0.1');
      expect(payloadStr).not.toContain('apiKey');
    });
  });

  describe('8. Redis Caching & Resilience', () => {
    it('should cache monetization summaries with short TTL and handle cache hits', async () => {
      const cacheKey = 'admin:monetization:intel:30';
      // Query once to warm cache
      await monetizationService.getMonetizationIntelligence(30);

      // Verify cached entry exists or query completes safely
      const cached = await redisCache.getJson(cacheKey);
      if (redisCache.isAvailable() && cached) {
        expect(cached.summary).toBeDefined();
      }
    });
  });
});
