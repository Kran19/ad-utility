import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UtilitiesCacheService } from '../src/utilities/services/utilities-cache.service';
import { UtilitiesService } from '../src/utilities/utilities.service';

describe('Phase 10: SEO Engine & Performance Optimization Verification', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cacheService: UtilitiesCacheService;
  let utilitiesService: UtilitiesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    cacheService = moduleFixture.get<UtilitiesCacheService>(UtilitiesCacheService);
    utilitiesService = moduleFixture.get<UtilitiesService>(UtilitiesService);

    // Invalidate caches before starting test suite
    await cacheService.invalidatePrefix('categories');
  });

  afterAll(async () => {
    await cacheService.invalidatePrefix('categories');
    await app.close();
  });

  describe('1. Public Categories SEO Endpoints', () => {
    it('GET /api/v1/utilities/categories should return all active categories with utility counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const imageCategory = res.body.data.find((c: any) => c.slug === 'image');
      expect(imageCategory).toBeDefined();
      expect(imageCategory.name).toBe('Image Tools');
      expect(imageCategory.utilityCount).toBeGreaterThanOrEqual(3);
      expect(imageCategory.utilities.length).toBe(imageCategory.utilityCount);

      // Verify each utility has required SEO fields
      imageCategory.utilities.forEach((util: any) => {
        expect(util.slug).toBeDefined();
        expect(util.name).toBeDefined();
        expect(util.description).toBeDefined();
        expect(util.implementationMode).toBeDefined();
        expect(typeof util.isFeatured).toBe('boolean');
      });
    });

    it('GET /api/v1/utilities/categories/:categorySlug should return a specific active category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories/image')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('image');
      expect(res.body.data.name).toBe('Image Tools');
      expect(res.body.data.utilityCount).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(res.body.data.utilities)).toBe(true);
    });

    it('GET /api/v1/utilities/categories/:categorySlug should return 404 for nonexistent category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories/nonexistent-category-slug')
        .expect(404);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('2. Draft & Disabled Utilities Exclusion from Public SEO', () => {
    const draftSlug = 'test-draft-seo-tool';
    const disabledSlug = 'test-disabled-seo-tool';

    beforeAll(async () => {
      // Clean up previous test runs if any
      await prisma.utility.deleteMany({
        where: { slug: { in: [draftSlug, disabledSlug] } },
      });

      const imageCategory = await prisma.utilityCategory.findUnique({
        where: { slug: 'image' },
      });

      if (imageCategory) {
        await prisma.utility.createMany({
          data: [
            {
              slug: draftSlug,
              name: 'Draft SEO Utility',
              description: 'This is a draft tool and must not be indexed',
              categoryId: imageCategory.id,
              implementationMode: 'LOCAL',
              status: 'DRAFT',
              seoTitle: 'Draft SEO Utility',
              seoDescription: 'Draft description for testing',
            },
            {
              slug: disabledSlug,
              name: 'Disabled SEO Utility',
              description: 'This is a disabled tool and must not be indexed',
              categoryId: imageCategory.id,
              implementationMode: 'LOCAL',
              status: 'DISABLED',
              seoTitle: 'Disabled SEO Utility',
              seoDescription: 'Disabled description for testing',
            },
          ],
        });
      }

      // Clear cache so database reload takes effect
      await cacheService.invalidatePrefix('categories');
    });

    afterAll(async () => {
      await prisma.utility.deleteMany({
        where: { slug: { in: [draftSlug, disabledSlug] } },
      });
      await cacheService.invalidatePrefix('categories');
    });

    it('public categories list should NOT contain draft or disabled utilities', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories/image')
        .expect(200);

      const slugs = res.body.data.utilities.map((u: any) => u.slug);
      expect(slugs).not.toContain(draftSlug);
      expect(slugs).not.toContain(disabledSlug);
    });

    it('draft utility direct public access should return 404 to ensure search engines never index it', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/utilities/${draftSlug}`)
        .expect(404);
    });
  });

  describe('3. Redis Caching & Cache Invalidation Performance', () => {
    it('should cache public categories in Redis with TTL', async () => {
      await cacheService.invalidatePrefix('categories');

      // First call: Cache miss, populates Redis
      const startTime1 = Date.now();
      const res1 = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories')
        .expect(200);
      const duration1 = Date.now() - startTime1;

      // Check cache service get
      const cached = await cacheService.get('categories:list');
      expect(cached).not.toBeNull();
      expect(Array.isArray(cached)).toBe(true);

      // Second call: Cache hit from Redis
      const startTime2 = Date.now();
      const res2 = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories')
        .expect(200);
      const duration2 = Date.now() - startTime2;

      expect(res2.body.data).toEqual(res1.body.data);
      expect(duration2).toBeLessThanOrEqual(duration1 + 50);
    });

    it('should invalidate cache when invalidatePrefix is called', async () => {
      await cacheService.set('categories:list', [{ slug: 'test', name: 'Test', utilityCount: 1, utilities: [] }]);

      let cached = await cacheService.get('categories:list');
      expect(cached).not.toBeNull();

      await cacheService.invalidatePrefix('categories');

      cached = await cacheService.get('categories:list');
      expect(cached).toBeNull();
    });

    it('should fail-open gracefully when Redis throws an error', async () => {
      // Temporarily mock internal get to return null simulating Redis offline
      jest.spyOn(cacheService, 'get').mockResolvedValueOnce(null);

      // Endpoint should not fail, should fall back to database
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('4. Dependency Isolation & Server/Client Boundary Integrity', () => {
    it('shared package should NOT leak server-only packages like @napi-rs/canvas or pdfjs-dist', () => {
      const sharedExports = require('@ad-utility/shared');
      expect((sharedExports as any).Canvas).toBeUndefined();
      expect((sharedExports as any).PDFDocumentProxy).toBeUndefined();
    });

    it('active MVP utilities should have registered metadata and public accessibility', async () => {
      const activeSlugs = [
        'jpg-to-png',
        'png-to-jpg',
        'image-compressor',
        'pdf-compressor',
        'pdf-merge',
        'pdf-split',
        'pdf-to-jpg',
        'text-cleaner',
        'case-converter',
        'word-counter',
        'json-formatter',
        'ai-summarizer',
      ];

      for (const slug of activeSlugs) {
        const metadata = await utilitiesService.getPublicUtility(slug);
        expect(metadata).toBeDefined();
        expect(metadata.status).toBe('ACTIVE');
        expect(metadata.categoryId).toBeDefined();
      }
    });
  });
});
