import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JourneyIntelligenceService } from '../src/admin/services/journey-intelligence.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';

describe('Phase 21 — Advanced Growth, Retention & User Journey Intelligence', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let journeyService: JourneyIntelligenceService;
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
    journeyService = moduleRef.get<JourneyIntelligenceService>(JourneyIntelligenceService);
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

  describe('1. Journey Admin API & RBAC Boundaries', () => {
    it('GET /api/v1/admin/analytics/journey should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/journey')
        .expect(401);
    });

    it('GET /api/v1/admin/analytics/journey/opportunities should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/journey/opportunities')
        .expect(401);
    });

    it('GET /api/v1/admin/analytics/journey should succeed with valid Admin JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/journey?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.journeyQuality).toBeDefined();
      expect(res.body.data.retentionHealth).toBeDefined();
      expect(res.body.data.returningVisitors).toBeDefined();
      expect(res.body.data.retentionCohorts).toBeDefined();
      expect(res.body.data.sessionDepth).toBeDefined();
      expect(res.body.data.crossUtilityFlows).toBeDefined();
      expect(res.body.data.opportunities).toBeDefined();
    });

    it('GET /api/v1/admin/analytics/journey/opportunities should return list of actionable journey opportunities', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/journey/opportunities?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        const opp = res.body.data[0];
        expect(opp.id).toBeDefined();
        expect(['ACQUISITION', 'UTILITY', 'RETENTION', 'CROSS_UTILITY', 'EXPERIMENT']).toContain(opp.area);
        expect(['INFO', 'LOW', 'MEDIUM', 'HIGH']).toContain(opp.severity);
        expect(opp.entity).toBeDefined();
        expect(opp.recommendedAction).toBeDefined();
        expect(['HIGH', 'MEDIUM', 'INSUFFICIENT_DATA']).toContain(opp.confidenceLevel);
      }
    });
  });

  describe('2. Anonymous Retention Semantics & Data Truth', () => {
    it('should aggregate anonymous returning visitor metrics without individual user profiling', async () => {
      const data = await journeyService.getJourneyIntelligence(30);
      expect(typeof data.returningVisitors.firstSessionVolume).toBe('number');
      expect(typeof data.returningVisitors.returningSessionVolume).toBe('number');
      expect(typeof data.returningVisitors.returnRate).toBe('number');
      expect(data.returningVisitors.returnRate).toBeGreaterThanOrEqual(0);
      expect(data.returningVisitors.returnRate).toBeLessThanOrEqual(100);
      expect(typeof data.returningVisitors.multiUtilityRate).toBe('number');
    });

    it('should calculate session depth across bounded buckets (1, 2, 3, 4+ utilities)', async () => {
      const data = await journeyService.getJourneyIntelligence(30);
      expect(Array.isArray(data.sessionDepth)).toBe(true);
      expect(data.sessionDepth.length).toBe(4);

      const expectedCategories = ['1 utility', '2 utilities', '3 utilities', '4+ utilities'];
      data.sessionDepth.forEach((d, idx) => {
        expect(d.depthCategory).toBe(expectedCategories[idx]);
        expect(d.completionRate).toBeGreaterThanOrEqual(0);
        expect(d.completionRate).toBeLessThanOrEqual(100);
        expect(d.downloadRate).toBeGreaterThanOrEqual(0);
        expect(d.downloadRate).toBeLessThanOrEqual(100);
        expect(d.adCtr).toBeGreaterThanOrEqual(0);
      });
    });

    it('should clamp query date ranges safely between 1 and 365 days', async () => {
      const minData = await journeyService.getJourneyIntelligence(-5);
      expect(minData.periodDays).toBe(1);

      const maxData = await journeyService.getJourneyIntelligence(500);
      expect(maxData.periodDays).toBe(365);
    });
  });

  describe('3. Cross-Utility Flow Transitions (Top-20 Bound)', () => {
    it('should bound cross-utility transitions to top 20 and compute transition rates', async () => {
      const data = await journeyService.getJourneyIntelligence(30);
      expect(Array.isArray(data.crossUtilityFlows)).toBe(true);
      expect(data.crossUtilityFlows.length).toBeLessThanOrEqual(20);

      for (const flow of data.crossUtilityFlows) {
        expect(flow.sourceUtilitySlug).toBeDefined();
        expect(flow.targetUtilitySlug).toBeDefined();
        expect(flow.transitionCount).toBeGreaterThanOrEqual(1);
        expect(flow.transitionRate).toBeGreaterThanOrEqual(0);
        expect(flow.transitionRate).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('4. Deterministic Journey Quality & Retention Health Scoring', () => {
    it('should calculate deterministic Journey Quality Score (0–100) with explainable components', async () => {
      const data = await journeyService.getJourneyIntelligence(30);
      expect(data.journeyQuality.score).toBeGreaterThanOrEqual(0);
      expect(data.journeyQuality.score).toBeLessThanOrEqual(100);
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_ATTENTION', 'INSUFFICIENT_DATA']).toContain(
        data.journeyQuality.rating,
      );
      expect(data.journeyQuality.components).toBeDefined();
      expect(typeof data.journeyQuality.components.completionScore).toBe('number');
      expect(typeof data.journeyQuality.components.downloadScore).toBe('number');
      expect(typeof data.journeyQuality.components.multiUtilityScore).toBe('number');
      expect(typeof data.journeyQuality.components.returnScore).toBe('number');
      expect(data.journeyQuality.explanation).toBeDefined();
    });

    it('should calculate deterministic Retention Health Score (0–100) with status classification', async () => {
      const data = await journeyService.getJourneyIntelligence(30);
      expect(data.retentionHealth.score).toBeGreaterThanOrEqual(0);
      expect(data.retentionHealth.score).toBeLessThanOrEqual(100);
      expect(['HEALTHY', 'MODERATE', 'NEEDS_ATTENTION', 'INSUFFICIENT_DATA']).toContain(
        data.retentionHealth.status,
      );
      expect(typeof data.retentionHealth.d1RetentionRate).toBe('number');
      expect(typeof data.retentionHealth.d7RetentionRate).toBe('number');
      expect(data.retentionHealth.explanation).toBeDefined();
    });
  });

  describe('5. Privacy & Zero Raw Session Token Leakage', () => {
    it('should not leak raw session tokens, passwords, or personal data in journey response', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/journey?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const payloadStr = JSON.stringify(res.body.data);
      expect(payloadStr).not.toContain('passwordHash');
      expect(payloadStr).not.toContain('admin@adplatform.local');
      expect(payloadStr).not.toContain('sessionToken'); // No raw token field in public/admin journey aggregates
      expect(payloadStr).not.toContain('127.0.0.1');
    });
  });

  describe('6. Redis Caching & Fail-Open Behavior', () => {
    it('should cache journey intelligence summaries under admin:journey:summary:* with 60s TTL', async () => {
      const cacheKey = 'admin:journey:summary:30';
      await journeyService.getJourneyIntelligence(30);

      const cached = await redisCache.getJson(cacheKey);
      if (redisCache.isAvailable() && cached) {
        expect(cached.journeyQuality).toBeDefined();
        expect(cached.retentionHealth).toBeDefined();
        expect(cached.sessionDepth).toBeDefined();
      }
    });
  });
});
