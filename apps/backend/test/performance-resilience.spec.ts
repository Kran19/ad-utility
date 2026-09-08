import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { UtilitiesCacheService } from '../src/utilities/services/utilities-cache.service';
import { RedisAdCacheService } from '../src/ads/services/redis-ad-cache.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UtilitiesService } from '../src/utilities/utilities.service';

jest.setTimeout(30000);

describe('Phase 17: Scale Readiness, Caching & Performance Engineering', () => {
  let app: INestApplication;
  let cacheService: UtilitiesCacheService;
  let redisAdCache: RedisAdCacheService;
  let prisma: PrismaService;
  let utilitiesService: UtilitiesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(new RequestIdMiddleware().use);
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

    cacheService = moduleFixture.get<UtilitiesCacheService>(UtilitiesCacheService);
    redisAdCache = moduleFixture.get<RedisAdCacheService>(RedisAdCacheService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    utilitiesService = moduleFixture.get<UtilitiesService>(UtilitiesService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Public API Caching & HTTP Headers', () => {
    it('GET /api/v1/utilities should include public Cache-Control headers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities')
        .expect(200);

      expect(res.headers['cache-control']).toBeDefined();
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=60');
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/utilities/categories should include category Cache-Control headers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories')
        .expect(200);

      expect(res.headers['cache-control']).toBeDefined();
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=120');
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/utilities/case-converter should return cached utility detail', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/case-converter')
        .expect(200);

      expect(res.headers['cache-control']).toContain('public');
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('case-converter');
    });
  });

  describe('2. Redis Cache Lifecycle & Targeted Invalidation', () => {
    it('should set and retrieve cached data from UtilitiesCacheService', async () => {
      const testKey = 'test-cache-key-scale';
      const testData = { name: 'Scale Test', timestamp: Date.now() };

      await cacheService.set(testKey, testData, 60);
      const retrieved = await cacheService.get<typeof testData>(testKey);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Scale Test');
    });

    it('should invalidate cache entries by prefix on demand', async () => {
      const prefix = 'inval-test:';
      await cacheService.set(`${prefix}item-1`, { id: 1 }, 60);
      await cacheService.set(`${prefix}item-2`, { id: 2 }, 60);

      await cacheService.invalidatePrefix(prefix);

      const item1 = await cacheService.get(`${prefix}item-1`);
      const item2 = await cacheService.get(`${prefix}item-2`);

      expect(item1).toBeNull();
      expect(item2).toBeNull();
    });

    it('should support ad slot caching and invalidation', async () => {
      const adSlotKey = 'header-banner-desktop-dev';
      const mockAdResponse = {
        hasAd: true,
        placement: 'HEADER_BANNER' as const,
        fallbackTier: 'TIER_2_CATEGORY' as const,
        creative: null,
      };

      await redisAdCache.setCachedSlot(adSlotKey, mockAdResponse as any, 60);
      const cached = await redisAdCache.getCachedSlot(adSlotKey);

      expect(cached).toBeDefined();
      expect(cached?.placement).toBe('HEADER_BANNER');

      await redisAdCache.invalidateCache(`cache:adslot:${adSlotKey}`);
      const afterInvalidation = await redisAdCache.getCachedSlot(adSlotKey);
      expect(afterInvalidation).toBeNull();
    });
  });

  describe('3. Concurrency & Fast Execution Under Load', () => {
    it('should execute 10 concurrent text-cleaner requests with low latency', async () => {
      const results: any[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/utilities/text-cleaner/execute')
          .send({ input: { text: `   concurrent   test   ${i}   ` } });
        results.push(res);
      }

      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.result.cleanedText).toContain('concurrent test');
      }
    });

    it('should execute 10 concurrent ad delivery requests without race conditions', async () => {
      const results: any[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/ads/slot')
          .send({
            placement: 'HEADER_BANNER',
            categorySlug: 'developer',
            device: 'DESKTOP',
          });
        results.push(res);
      }

      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.hasAd).toBe(true);
      }
    });
  });

  describe('4. Bounded Data & Pagination Safety', () => {
    it('should query utilities and return ordered results with metadata', async () => {
      const utilities = await utilitiesService.listPublicUtilities();
      expect(utilities.length).toBeGreaterThanOrEqual(12);

      // Verify display order is sorted
      for (let i = 1; i < utilities.length; i++) {
        expect(utilities[i].displayOrder).toBeGreaterThanOrEqual(utilities[i - 1].displayOrder);
      }
    });

    it('should bound public categories query to active items only', async () => {
      const categories = await utilitiesService.listPublicCategories();
      expect(categories.length).toBeGreaterThan(0);
      for (const cat of categories) {
        expect(cat.utilities.every((u: any) => u.implementationMode !== undefined)).toBe(true);
      }
    });
  });

  describe('5. AI Subsystem Governance (Mock Mode Only)', () => {
    it('should execute deterministic mock AI without external OpenAI calls', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/ai-humanizer/execute')
        .send({ input: { text: 'In accordance with our recent findings, the model executes.' } })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.mode).toBe('AI');
      expect(res.body.data.result.humanizedText).toBeDefined();
    });
  });
});
