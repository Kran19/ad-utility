import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BusinessIntelligenceService } from '../src/admin/services/business-intelligence.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';

describe('Phase 20 — Revenue Attribution, Ad Optimization & Business Intelligence', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
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
    biService = moduleRef.get<BusinessIntelligenceService>(BusinessIntelligenceService);
    redisCache = moduleRef.get<RedisAdCacheService>(RedisAdCacheService);

    // Clean up any stale revenue records from preceding test suites
    await prisma.adRevenueRecord.deleteMany({}).catch(() => {});
    await redisCache?.invalidateCache('bi:*').catch(() => {});
    await redisCache?.invalidateCache('monetization:*').catch(() => {});

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

  describe('1. Business Intelligence Admin API & RBAC Boundaries', () => {
    it('GET /api/v1/admin/analytics/business-intelligence should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/business-intelligence')
        .expect(401);
    });

    it('GET /api/v1/admin/analytics/business-intelligence/opportunities should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/business-intelligence/opportunities')
        .expect(401);
    });

    it('GET /api/v1/admin/analytics/business-intelligence should succeed with valid Admin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/business-intelligence?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.kpis).toBeDefined();
      expect(res.body.data.health).toBeDefined();
      expect(res.body.data.acquisitionAttribution).toBeDefined();
      expect(res.body.data.utilityBusinessValues).toBeDefined();
      expect(res.body.data.adBusinessValues).toBeDefined();
      expect(res.body.data.opportunities).toBeDefined();
    });

    it('GET /api/v1/admin/analytics/business-intelligence/opportunities should return list of actionable opportunities', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/business-intelligence/opportunities?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        const opp = res.body.data[0];
        expect(opp.id).toBeDefined();
        expect(['ACQUISITION', 'UTILITY', 'AD', 'EXPERIMENT']).toContain(opp.area);
        expect(['INFO', 'WARNING', 'CRITICAL']).toContain(opp.severity);
        expect(opp.entity).toBeDefined();
        expect(opp.recommendedAction).toBeDefined();
      }
    });
  });

  describe('2. Business KPIs & Data Truth Verification', () => {
    it('should explicitly state revenueAvailable: false and not fabricate monetary figures', async () => {
      const bi = await biService.getBusinessIntelligence(30);
      expect(bi.kpis.revenueAvailable).toBe(false);
      expect((bi.kpis as any).revenueUsd).toBeUndefined();
      expect((bi.kpis as any).actualProfit).toBeUndefined();
      expect(typeof bi.kpis.businessValueProxy).toBe('number');
      expect(bi.kpis.businessValueProxy).toBeGreaterThanOrEqual(0);
      expect(bi.kpis.businessValueProxy).toBeLessThanOrEqual(100);
    });

    it('should clamp and bound query date ranges safely', async () => {
      const biMin = await biService.getBusinessIntelligence(-10);
      expect(biMin.periodDays).toBe(1);

      const biMax = await biService.getBusinessIntelligence(999);
      expect(biMax.periodDays).toBe(365);
    });
  });

  describe('3. Acquisition Attribution & Quality Scoring', () => {
    it('should compute deterministic 0-100 quality scores for acquisition sources', async () => {
      const bi = await biService.getBusinessIntelligence(30);
      expect(bi.acquisitionAttribution.length).toBeGreaterThan(0);

      for (const a of bi.acquisitionAttribution) {
        expect(a.source).toBeDefined();
        expect(a.acquisitionQualityScore).toBeGreaterThanOrEqual(0);
        expect(a.acquisitionQualityScore).toBeLessThanOrEqual(100);
        expect(['HIGH_QUALITY', 'AVERAGE', 'LOW_QUALITY', 'INSUFFICIENT_DATA']).toContain(a.status);
      }
    });
  });

  describe('4. Utility Business Value & Growth Opportunity Ranking', () => {
    it('should rank all utilities with priority ranks and bounded opportunity scores', async () => {
      const bi = await biService.getBusinessIntelligence(30);
      expect(bi.utilityBusinessValues.length).toBeGreaterThan(0);

      for (let i = 0; i < bi.utilityBusinessValues.length; i++) {
        const u = bi.utilityBusinessValues[i];
        expect(u.priorityRank).toBe(i + 1);
        expect(u.opportunityScore).toBeGreaterThanOrEqual(0);
        expect(u.opportunityScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('5. Platform Business Health Score', () => {
    it('should calculate an explainable 0-100 health score with subcomponents', async () => {
      const bi = await biService.getBusinessIntelligence(30);
      expect(bi.health.overallScore).toBeGreaterThanOrEqual(0);
      expect(bi.health.overallScore).toBeLessThanOrEqual(100);
      expect(['EXCELLENT', 'HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL']).toContain(bi.health.status);
      expect(typeof bi.health.components.acquisitionQuality).toBe('number');
      expect(typeof bi.health.components.funnelHealth).toBe('number');
      expect(typeof bi.health.components.monetizationEfficiency).toBe('number');
      expect(typeof bi.health.components.reliabilityHealth).toBe('number');
    });
  });

  describe('6. Prioritized Optimization Opportunities', () => {
    it('should emit structured non-destructive advisory recommendations', async () => {
      const opps = await biService.getOpportunities(30);
      expect(Array.isArray(opps)).toBe(true);
      expect(opps.length).toBeGreaterThan(0);

      for (const o of opps) {
        expect(o.id).toBeDefined();
        expect(o.reason).toBeDefined();
        expect(o.recommendedAction).toBeDefined();
        expect(['HIGH', 'MEDIUM', 'INSUFFICIENT_DATA']).toContain(o.confidenceLevel);
      }
    });
  });

  describe('7. Privacy & Data Protection', () => {
    it('should not leak passwords, raw IP addresses, or private credentials in BI responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/business-intelligence?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const payloadStr = JSON.stringify(res.body.data);
      expect(payloadStr).not.toContain('passwordHash');
      expect(payloadStr).not.toContain('admin@adplatform.local');
      expect(payloadStr).not.toContain('127.0.0.1');
      expect(payloadStr).not.toContain('secretKey');
    });
  });

  describe('8. Redis Caching & Resilience', () => {
    it('should cache BI summaries with short TTL and handle cache hits', async () => {
      const cacheKey = 'admin:bi:summary:30';
      await biService.getBusinessIntelligence(30);

      const cached = await redisCache.getJson(cacheKey);
      if (redisCache.isAvailable() && cached) {
        expect(cached.kpis).toBeDefined();
        expect(cached.health).toBeDefined();
      }
    });
  });
});
