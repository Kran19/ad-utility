import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  UtilityRegistry,
  JsonFormatterAdapter,
  WordCounterAdapter,
  TextHashAdapter,
} from '@ad-utility/shared';

jest.setTimeout(30000);

describe('Phase 4: Utility Engine, Hybrid Registry & Execution Verification', () => {
  let app: INestApplication;
  let utilitiesService: UtilitiesService;
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

    utilitiesService = moduleFixture.get<UtilitiesService>(UtilitiesService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Code-First Utility Registry', () => {
    let registry: UtilityRegistry;

    beforeEach(() => {
      registry = new UtilityRegistry();
    });

    it('should register and resolve an adapter by slug', () => {
      const adapter = new JsonFormatterAdapter();
      registry.register(adapter);

      expect(registry.has('json-formatter')).toBe(true);
      expect(registry.get('json-formatter')).toBe(adapter);
    });

    it('should reject duplicate slug registration with error', () => {
      const adapter1 = new JsonFormatterAdapter();
      const adapter2 = new JsonFormatterAdapter();
      registry.register(adapter1);

      expect(() => registry.register(adapter2)).toThrow(
        'Duplicate utility adapter registration',
      );
    });

    it('should return undefined for unregistered slugs', () => {
      expect(registry.get('unknown-slug')).toBeUndefined();
      expect(registry.has('unknown-slug')).toBe(false);
    });

    it('should list all registered adapters', () => {
      registry.register(new JsonFormatterAdapter());
      registry.register(new WordCounterAdapter());
      registry.register(new TextHashAdapter());

      const list = registry.list();
      expect(list.length).toBe(3);
      expect(list.map((a) => a.slug)).toEqual([
        'json-formatter',
        'word-counter',
        'text-hash',
      ]);
    });
  });

  describe('2. Metadata Synchronization & Lifecycle Resolution', () => {
    it('should resolve public metadata for ACTIVE utility with code adapter', async () => {
      const result = await utilitiesService.getPublicUtility('json-formatter');

      expect(result).toBeDefined();
      expect(result.slug).toBe('json-formatter');
      expect(result.status).toBe('ACTIVE');
      expect(result.implementationMode).toBe('LOCAL');
      expect(result.categorySlug).toBe('developer');
      expect(result.isAdapterAvailable).toBe(true);
      expect(result.faqContent.length).toBeGreaterThan(0);
    });

    it('should throw 404 for DRAFT utility (draft-tool)', async () => {
      await expect(
        utilitiesService.getPublicUtility('draft-tool'),
      ).rejects.toThrow('unpublished or disabled');
    });

    it('should throw 404 for DISABLED utility (disabled-tool)', async () => {
      await expect(
        utilitiesService.getPublicUtility('disabled-tool'),
      ).rejects.toThrow('unpublished or disabled');
    });

    it('should throw 404 for non-existent slug in DB', async () => {
      await expect(
        utilitiesService.getPublicUtility('non-existent-tool'),
      ).rejects.toThrow('was not found');
    });

    it('should list only active utilities with optional category filter', async () => {
      const allActive = await utilitiesService.listPublicUtilities();
      expect(allActive.length).toBeGreaterThanOrEqual(4);
      expect(allActive.every((u) => u.status === 'ACTIVE')).toBe(true);

      const devTools = await utilitiesService.listPublicUtilities('developer');
      expect(devTools.length).toBeGreaterThanOrEqual(2);
      expect(devTools.every((u) => u.categorySlug === 'developer')).toBe(true);
    });
  });

  describe('3. Execution Modes & Validation (LOCAL, SERVER, AI)', () => {
    it('LOCAL adapter: should format valid JSON string', async () => {
      const response = await utilitiesService.executeUtility('json-formatter', {
        text: '{"name":"test","count":42}',
      });

      expect(response).toBeDefined();
      expect(response.mode).toBe('LOCAL');
      expect(response.result.formatted).toContain('{\n  "name": "test",\n  "count": 42\n}');
      expect(response.result.lineCount).toBe(4);
    });

    it('LOCAL adapter: should reject malformed JSON with BadRequestException', async () => {
      await expect(
        utilitiesService.executeUtility('json-formatter', {
          text: '{malformed json}',
        }),
      ).rejects.toThrow('Invalid JSON syntax');
    });

    it('LOCAL adapter: should count words and characters accurately', async () => {
      const response = await utilitiesService.executeUtility('word-counter', {
        text: 'Hello world from Phase 4 execution engine!',
      });

      expect(response.mode).toBe('LOCAL');
      expect(response.result.wordCount).toBe(7);
      expect(response.result.charCount).toBe(42);
    });

    it('SERVER adapter: should generate valid SHA-256 hash', async () => {
      const response = await utilitiesService.executeUtility('text-hash', {
        text: 'Antigravity Platform',
        algorithm: 'sha256',
      });

      expect(response.mode).toBe('SERVER');
      expect(response.result.hash).toBeDefined();
      expect(response.result.algorithm).toBe('sha256');
      expect(response.result.length).toBe(64);
    });

    it('AI adapter: should process through shielded AI interface without external API calls', async () => {
      const response = await utilitiesService.executeUtility('ai-summarizer', {
        text: 'Artificial intelligence is transforming modern software development.',
      });

      expect(response.mode).toBe('AI');
      expect(response.result.summary).toContain('[AI Summary Preview for Phase 4]');
      expect(response.result.originalWordCount).toBe(7);
    });
  });

  describe('4. Resource Limits & Error Handling', () => {
    it('should reject payload exceeding maxInputSizeBytes', async () => {
      // 6MB string exceeding 5MB limit
      const oversizedText = 'a'.repeat(6 * 1024 * 1024);

      await expect(
        utilitiesService.executeUtility('json-formatter', {
          text: oversizedText,
        }),
      ).rejects.toThrow('exceeds maximum size');
    });

    it('should fail cleanly when database row exists but code adapter is missing', async () => {
      // Create a temporary test tool in DB without code adapter
      const testCategory = await prisma.utilityCategory.findFirst();
      await prisma.utility.upsert({
        where: { slug: 'unimplemented-tool' },
        update: { status: 'ACTIVE' },
        create: {
          slug: 'unimplemented-tool',
          name: 'Unimplemented Tool',
          description: 'Testing missing adapter behavior',
          categoryId: testCategory!.id,
          implementationMode: 'SERVER',
          status: 'ACTIVE',
          seoTitle: 'Unimplemented Tool',
          seoDescription: 'Unimplemented tool for testing',
        },
      });

      await expect(
        utilitiesService.executeUtility('unimplemented-tool', { text: 'test' }),
      ).rejects.toThrow('currently not available');

      // Cleanup
      await prisma.utility.delete({ where: { slug: 'unimplemented-tool' } });
    });
  });

  describe('5. HTTP API Endpoints (/api/v1/utilities)', () => {
    it('GET /api/v1/utilities - should return active utilities envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('GET /api/v1/utilities/:slug - should return metadata for active utility', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/json-formatter')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('json-formatter');
      expect(res.body.data.seoTitle).toBeDefined();
    });

    it('GET /api/v1/utilities/:slug - should return 404 for unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/utilities/non-existent-tool')
        .expect(404);
    });

    it('GET /api/v1/utilities/:slug - should return 404 for disabled utility', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/utilities/disabled-tool')
        .expect(404);
    });

    it('POST /api/v1/utilities/:slug/execute - should execute tool over HTTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/text-hash/execute')
        .send({
          input: {
            text: 'Hello World',
            algorithm: 'sha256',
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.result.hash).toBeDefined();
      expect(res.body.data.mode).toBe('SERVER');
      expect(res.body.data.requestId).toBeDefined();
    });

    it('POST /api/v1/utilities/:slug/execute - should return 400 on bad input', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/utilities/json-formatter/execute')
        .send({
          input: {
            text: 'not a valid json',
          },
        })
        .expect(400);
    });
  });
});
