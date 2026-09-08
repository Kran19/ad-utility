import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { SeoIntelligenceService } from '../src/admin/services/seo-intelligence.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';

describe('Phase 22 — SEO Content Intelligence & Organic Growth Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let seoService: SeoIntelligenceService;
  let authService: AuthService;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    authService = moduleFixture.get<AuthService>(AuthService);
    seoService = moduleFixture.get<SeoIntelligenceService>(SeoIntelligenceService);

    // Obtain Admin JWT for authenticated endpoint tests
    const loginRes = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminToken = loginRes.accessToken || '';

    // Standard user token without analytics permissions
    userToken = jwtService.sign({
      sub: 'user-phase22-id',
      email: 'user-phase22@example.com',
      role: 'USER',
      permissions: [],
    });

    // Seed sample telemetry events with first-touch and organic markers
    const now = new Date();
    await prisma.analyticsEvent.createMany({
      data: [
        {
          eventType: 'PAGE_VIEW',
          utilitySlug: 'image-compressor',
          utmSource: 'google',
          utmMedium: 'organic',
          sessionToken: 'anon_seo_session_1',
          timestamp: now,
        },
        {
          eventType: 'TOOL_START',
          utilitySlug: 'image-compressor',
          utmSource: 'google',
          utmMedium: 'organic',
          sessionToken: 'anon_seo_session_1',
          timestamp: now,
        },
        {
          eventType: 'TOOL_COMPLETE',
          utilitySlug: 'image-compressor',
          utmSource: 'google',
          utmMedium: 'organic',
          sessionToken: 'anon_seo_session_1',
          timestamp: now,
        },
        {
          eventType: 'RESULT_DOWNLOAD',
          utilitySlug: 'image-compressor',
          utmSource: 'google',
          utmMedium: 'organic',
          sessionToken: 'anon_seo_session_1',
          timestamp: now,
        },
        {
          eventType: 'PAGE_VIEW',
          utilitySlug: 'pdf-merger',
          utmSource: 'direct',
          utmMedium: 'direct',
          sessionToken: 'anon_seo_session_2',
          timestamp: now,
        },
        {
          eventType: 'PAGE_VIEW',
          utilitySlug: 'pdf-split',
          utmSource: 'bing',
          utmMedium: 'search',
          sessionToken: 'anon_seo_session_3',
          timestamp: now,
        },
      ],
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Security & RBAC Guards', () => {
    it('should reject unauthenticated requests to SEO intelligence endpoint (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo')
        .expect(401);
    });

    it('should reject non-admin users without analytics:read permission (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow authorized admins with analytics:read permission (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.health).toBeDefined();
      expect(res.body.data.organicAcquisition).toBeDefined();
      expect(res.body.data.opportunities).toBeInstanceOf(Array);
      expect(res.body.data.utilityPerformance).toBeInstanceOf(Array);
      expect(res.body.data.categoryPerformance).toBeInstanceOf(Array);
      expect(res.body.data.internalLinkOpportunities).toBeInstanceOf(Array);
      expect(res.body.data.coverage).toBeDefined();
      expect(res.body.data.sitemapStatus).toBeDefined();
    });
  });

  describe('2. Organic Acquisition Classification & Performance', () => {
    it('should accurately aggregate first-party organic metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const acquisition = res.body.data.organicAcquisition;
      expect(acquisition.totalOrganicVisits).toBeGreaterThanOrEqual(2); // session_1 and session_3
      expect(acquisition.totalOrganicToolStarts).toBeGreaterThanOrEqual(1);
      expect(acquisition.totalOrganicCompletions).toBeGreaterThanOrEqual(1);
      expect(acquisition.totalOrganicDownloads).toBeGreaterThanOrEqual(1);
      expect(acquisition.organicCompletionRate).toBeGreaterThanOrEqual(0);
      expect(acquisition.organicSharePercentage).toBeGreaterThanOrEqual(0);
    });

    it('should compute utility-level and category-level organic performance', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const utilityPerf = res.body.data.utilityPerformance;
      const compressor = utilityPerf.find((u: any) => u.utilitySlug === 'image-compressor');
      expect(compressor).toBeDefined();
      expect(compressor.organicPageViews).toBeGreaterThanOrEqual(1);
      expect(compressor.completions).toBeGreaterThanOrEqual(1);
      expect(compressor.downloads).toBeGreaterThanOrEqual(1);

      const categoryPerf = res.body.data.categoryPerformance;
      expect(categoryPerf.length).toBeGreaterThanOrEqual(4);
      const imgCategory = categoryPerf.find((c: any) => c.categorySlug === 'image');
      expect(imgCategory).toBeDefined();
      expect(imgCategory.coverageStatus).toBe('COMPLETE');
    });
  });

  describe('3. SEO Health & Metadata Completeness Audit', () => {
    it('should return deterministic page health audit and overall health score', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo/page-health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(18); // 18 utilities + categories

      for (const page of res.body.data) {
        expect(page.slug).toBeDefined();
        expect(page.pageType).toBeDefined();
        expect(typeof page.hasTitle).toBe('boolean');
        expect(typeof page.hasDescription).toBe('boolean');
        expect(typeof page.hasCanonical).toBe('boolean');
        expect(typeof page.hasOpenGraph).toBe('boolean');
        expect(typeof page.hasTwitterMetadata).toBe('boolean');
        expect(typeof page.hasJsonLd).toBe('boolean');
        expect(typeof page.hasBreadcrumbs).toBe('boolean');
        expect(page.healthScore).toBeGreaterThanOrEqual(0);
        expect(page.healthScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('4. Deterministic SEO Opportunity Engine', () => {
    it('should rank opportunities with explainable reasons and actions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo/opportunities?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const opp of res.body.data) {
        expect(opp.id).toBeDefined();
        expect(opp.utilitySlug || opp.categorySlug).toBeDefined();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(opp.priority);
        expect(opp.score).toBeGreaterThanOrEqual(0);
        expect(opp.score).toBeLessThanOrEqual(100);
        expect(opp.reason).toBeDefined();
        expect(opp.recommendedAction).toBeDefined();
        expect(opp.supportingMetrics).toBeDefined();
      }

      // Verify descending order of opportunity scores
      for (let i = 1; i < res.body.data.length; i++) {
        expect(res.body.data[i - 1].score).toBeGreaterThanOrEqual(res.body.data[i].score);
      }
    });
  });

  describe('5. Internal Linking Recommendations', () => {
    it('should return reciprocal and semantic internal linking suggestions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo/internal-links')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);

      const pdfPair = res.body.data.find(
        (l: any) => l.sourceUtilitySlug === 'pdf-merge' && l.targetUtilitySlug === 'pdf-split',
      );
      expect(pdfPair).toBeDefined();
      expect(pdfPair.relationshipType).toBe('RECIPROCAL');
      expect(pdfPair.reason).toBeDefined();
    });
  });

  describe('6. Content Coverage Matrix & Sitemap Verification', () => {
    it('should audit content coverage across utility/category combinations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo/content-coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalActiveUtilities).toBeGreaterThanOrEqual(12);
      expect(res.body.data.totalCategories).toBeGreaterThanOrEqual(4);
      expect(['COMPLETE', 'PARTIAL', 'MISSING', 'NEEDS_REVIEW']).toContain(res.body.data.coverageStatus);
    });

    it('should verify sitemap discoverability', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const sitemap = res.body.data.sitemapStatus;
      expect(sitemap.activeUtilitiesIncluded).toBeGreaterThanOrEqual(12);
      expect(sitemap.activeCategoriesIncluded).toBeGreaterThanOrEqual(4);
      expect(sitemap.status).toBe('VALID');
    });
  });

  describe('7. Privacy, Bounds & Fail-Open Behavior', () => {
    it('should not expose raw session tokens or sensitive data in SEO DTOs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const stringified = JSON.stringify(res.body.data);
      expect(stringified).not.toContain('anon_seo_session_1');
      expect(stringified).not.toContain('anon_seo_session_2');
      expect(stringified).not.toContain('anon_seo_session_3');
    });

    it('should gracefully bound days parameter to safe 1–365 range', async () => {
      const resNegative = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo?days=-10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(resNegative.body.success).toBe(true);

      const resExcessive = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo?days=9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(resExcessive.body.success).toBe(true);
    });

    it('should continue to serve SEO intelligence if Redis fails (fail-open)', async () => {
      const redisService = app.get(RedisAdCacheService);
      const originalGet = redisService.getJson;
      // Simulate redis error
      jest.spyOn(redisService, 'getJson').mockRejectedValueOnce(new Error('Redis connection timed out'));

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/seo?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.health).toBeDefined();

      // Restore
      jest.spyOn(redisService, 'getJson').mockImplementation(originalGet);
    });
  });
});
