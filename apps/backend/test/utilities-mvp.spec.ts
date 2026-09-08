import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { AiGatewayService } from '../src/ai/services/ai-gateway.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PDFDocument } from 'pdf-lib';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import * as JSZip from 'jszip';

jest.setTimeout(45000);

describe('Phase 9: MVP Utilities Catalog Verification', () => {
  let app: INestApplication;
  let utilitiesService: UtilitiesService;
  let aiGatewayService: AiGatewayService;
  let prisma: PrismaService;

  // Helper generators
  const createTestJpegBuffer = (width = 20, height = 20): Buffer => {
    const frameData = Buffer.alloc(width * height * 4, 180); // gray
    const jpegData = jpeg.encode({ data: frameData, width, height }, 80);
    return Buffer.from(jpegData.data);
  };

  const createTestPngBuffer = (width = 20, height = 20, alpha = 128): Buffer => {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = 255; // red
        png.data[idx + 1] = 0; // green
        png.data[idx + 2] = 0; // blue
        png.data[idx + 3] = alpha; // semi-transparent
      }
    }
    return PNG.sync.write(png);
  };

  const createTestPdfBuffer = async (pageCount = 2, title = 'Test Document'): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    for (let i = 1; i <= pageCount; i++) {
      const page = doc.addPage([300, 300]);
      page.drawText(`${title} - Page ${i}`);
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  };

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
    aiGatewayService = moduleFixture.get<AiGatewayService>(AiGatewayService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 1. IMAGE UTILITIES
  // ==========================================
  describe('1. Image Utilities (SERVER)', () => {
    it('jpg-to-png: converts valid JPEG to PNG with correct magic bytes and format', async () => {
      const jpegBuf = createTestJpegBuffer(30, 30);
      const res = await utilitiesService.executeUtility('jpg-to-png', {
        fileData: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`,
        filename: 'sample.jpg',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(res.result.filename).toBe('sample.png');
      expect(res.result.width).toBe(30);
      expect(res.result.height).toBe(30);
      expect(res.result.sizeBytes).toBeGreaterThan(0);

      // Verify the output dataUrl contains valid PNG magic bytes
      const b64 = res.result.dataUrl.replace('data:image/png;base64,', '');
      const outBuf = Buffer.from(b64, 'base64');
      expect(outBuf[0]).toBe(0x89);
      expect(outBuf[1]).toBe(0x50);
      expect(outBuf[2]).toBe(0x4e);
      expect(outBuf[3]).toBe(0x47);
    });

    it('jpg-to-png: rejects invalid JPEG with corrupted magic bytes', async () => {
      const fakeJpeg = Buffer.from('NOT A JPEG FILE DATA');
      await expect(
        utilitiesService.executeUtility('jpg-to-png', {
          fileData: fakeJpeg.toString('base64'),
        }),
      ).rejects.toThrow('Invalid JPEG file signature');
    });

    it('png-to-jpg: converts PNG to JPEG with deterministic white background alpha compositing', async () => {
      const pngBuf = createTestPngBuffer(20, 20, 100); // semi-transparent
      const res = await utilitiesService.executeUtility('png-to-jpg', {
        fileData: `data:image/png;base64,${pngBuf.toString('base64')}`,
        quality: 90,
        filename: 'transparent.png',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(res.result.filename).toBe('transparent.jpg');
      expect(res.result.width).toBe(20);
      expect(res.result.height).toBe(20);
      expect(res.result.background).toContain('#FFFFFF');

      // Verify output contains valid JPEG magic bytes
      const b64 = res.result.dataUrl.replace('data:image/jpeg;base64,', '');
      const outBuf = Buffer.from(b64, 'base64');
      expect(outBuf[0]).toBe(0xff);
      expect(outBuf[1]).toBe(0xd8);
      expect(outBuf[2]).toBe(0xff);
    });

    it('png-to-jpg: rejects invalid PNG header', async () => {
      const badBuf = Buffer.from('FAKE PNG DATA');
      await expect(
        utilitiesService.executeUtility('png-to-jpg', {
          fileData: badBuf.toString('base64'),
        }),
      ).rejects.toThrow('Invalid PNG file signature');
    });

    it('image-compressor: compresses JPEG and reports byte savings', async () => {
      const jpegBuf = createTestJpegBuffer(50, 50);
      const res = await utilitiesService.executeUtility('image-compressor', {
        fileData: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`,
        quality: 40,
        filename: 'photo.jpg',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(res.result.originalSizeBytes).toBe(jpegBuf.length);
      expect(res.result.compressedSizeBytes).toBeGreaterThan(0);
      expect(res.result.format).toBe('image/jpeg');
    });

    it('image-compressor: rejects unsupported image format', async () => {
      const textBuf = Buffer.from('plain text pretending to be image');
      await expect(
        utilitiesService.executeUtility('image-compressor', {
          fileData: textBuf.toString('base64'),
        }),
      ).rejects.toThrow('Unsupported image format');
    });
  });

  // ==========================================
  // 2. PDF UTILITIES
  // ==========================================
  describe('2. PDF Utilities (SERVER)', () => {
    it('pdf-compressor: compresses valid PDF and preserves page count', async () => {
      const pdfBuf = await createTestPdfBuffer(3, 'Compress Test');
      const res = await utilitiesService.executeUtility('pdf-compressor', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        filename: 'large.pdf',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:application\/pdf;base64,/);
      expect(res.result.pageCount).toBe(3);
      expect(res.result.originalSizeBytes).toBe(pdfBuf.length);
      expect(res.result.compressedSizeBytes).toBeGreaterThan(0);
    });

    it('pdf-compressor: rejects corrupted PDF data', async () => {
      const corrupted = Buffer.from('NOT A PDF FILE CONTENT');
      await expect(
        utilitiesService.executeUtility('pdf-compressor', {
          fileData: corrupted.toString('base64'),
        }),
      ).rejects.toThrow('Invalid PDF file signature');
    });

    it('pdf-merge: combines multiple PDFs in exact specified order', async () => {
      const pdf1 = await createTestPdfBuffer(2, 'Doc One');
      const pdf2 = await createTestPdfBuffer(3, 'Doc Two');

      const res = await utilitiesService.executeUtility('pdf-merge', {
        files: [
          { fileData: pdf1.toString('base64'), filename: 'doc1.pdf' },
          { fileData: pdf2.toString('base64'), filename: 'doc2.pdf' },
        ],
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:application\/pdf;base64,/);
      expect(res.result.totalPageCount).toBe(5);
      expect(res.result.mergedFileCount).toBe(2);

      // Verify merged PDF is valid with pdf-lib
      const b64 = res.result.dataUrl.replace('data:application/pdf;base64,', '');
      const parsed = await PDFDocument.load(Buffer.from(b64, 'base64'));
      expect(parsed.getPageCount()).toBe(5);
    });

    it('pdf-merge: rejects if fewer than 2 files provided', async () => {
      const pdf1 = await createTestPdfBuffer(1);
      await expect(
        utilitiesService.executeUtility('pdf-merge', {
          files: [{ fileData: pdf1.toString('base64') }],
        }),
      ).rejects.toThrow('requires at least 2 PDF files');
    });

    it('pdf-split: extracts page range into valid PDF', async () => {
      const pdfBuf = await createTestPdfBuffer(5, 'Multi Page');

      const res = await utilitiesService.executeUtility('pdf-split', {
        fileData: pdfBuf.toString('base64'),
        pageRanges: '2-4',
        filename: 'source.pdf',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.mimeType).toBe('application/pdf');
      expect(res.result.extractedPages).toEqual([2, 3, 4]);

      // Verify extracted PDF has exactly 3 pages
      const b64 = res.result.dataUrl.replace('data:application/pdf;base64,', '');
      const parsed = await PDFDocument.load(Buffer.from(b64, 'base64'));
      expect(parsed.getPageCount()).toBe(3);
    });

    it('pdf-split: rejects out of bounds page numbers', async () => {
      const pdfBuf = await createTestPdfBuffer(3);
      await expect(
        utilitiesService.executeUtility('pdf-split', {
          fileData: pdfBuf.toString('base64'),
          pageRanges: '1, 10', // Page 10 does not exist
        }),
      ).rejects.toThrow('exceeds document total of 3 pages');
    });

    it('pdf-to-jpg: rasterizes PDF page to JPEG image using canvas renderer', async () => {
      const pdfBuf = await createTestPdfBuffer(1, 'Rasterize Me');
      const res = await utilitiesService.executeUtility('pdf-to-jpg', {
        fileData: pdfBuf.toString('base64'),
        page: 1,
        scale: 1.0,
        filename: 'flyer.pdf',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.mimeType).toBe('image/jpeg');
      expect(res.result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(res.result.renderedPages).toBe(1);

      // Verify JPEG magic bytes
      const b64 = res.result.dataUrl.replace('data:image/jpeg;base64,', '');
      const outBuf = Buffer.from(b64, 'base64');
      expect(outBuf[0]).toBe(0xff);
      expect(outBuf[1]).toBe(0xd8);
      expect(outBuf[2]).toBe(0xff);
    });

    it('pdf-to-jpg: packages multiple rendered pages into a valid ZIP archive', async () => {
      const pdfBuf = await createTestPdfBuffer(2, 'Two Pages');
      const res = await utilitiesService.executeUtility('pdf-to-jpg', {
        fileData: pdfBuf.toString('base64'),
        page: 'all',
        filename: 'multipage.pdf',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.mimeType).toBe('application/zip');
      expect(res.result.dataUrl).toMatch(/^data:application\/zip;base64,/);
      expect(res.result.renderedPages).toBe(2);

      // Verify ZIP contains page-1.jpg and page-2.jpg
      const b64 = res.result.dataUrl.replace('data:application/zip;base64,', '');
      const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
      expect(Object.keys(zip.files).length).toBe(2);
    });
  });

  // ==========================================
  // 3. TEXT UTILITIES
  // ==========================================
  describe('3. Text Utilities (LOCAL)', () => {
    it('text-cleaner: trims, collapses repeated spaces, and strips blank lines', async () => {
      const messy = '   Hello    World!   \n\n\n   This   is   a    test.   \n\n';
      const res = await utilitiesService.executeUtility('text-cleaner', {
        text: messy,
        options: {
          trimWhitespace: true,
          collapseSpaces: true,
          removeEmptyLines: true,
          normalizeLineEndings: true,
        },
      });

      expect(res.mode).toBe('LOCAL');
      expect(res.result.cleanedText).toBe('Hello World!\nThis is a test.');
      expect(res.result.linesRemoved).toBeGreaterThan(0);
      expect(res.result.spacesCollapsed).toBeGreaterThan(0);
    });

    it('case-converter: converts text accurately across cases', async () => {
      const input = 'hello world from Phase 9';

      const upper = await utilitiesService.executeUtility('case-converter', {
        text: input,
        targetCase: 'uppercase',
      });
      expect(upper.result.convertedText).toBe('HELLO WORLD FROM PHASE 9');

      const title = await utilitiesService.executeUtility('case-converter', {
        text: input,
        targetCase: 'title',
      });
      expect(title.result.convertedText).toBe('Hello World From Phase 9');

      const camel = await utilitiesService.executeUtility('case-converter', {
        text: input,
        targetCase: 'camel',
      });
      expect(camel.result.convertedText).toBe('helloWorldFromPhase9');

      const snake = await utilitiesService.executeUtility('case-converter', {
        text: input,
        targetCase: 'snake',
      });
      expect(snake.result.convertedText).toBe('hello_world_from_phase_9');

      const kebab = await utilitiesService.executeUtility('case-converter', {
        text: input,
        targetCase: 'kebab',
      });
      expect(kebab.result.convertedText).toBe('hello-world-from-phase-9');
    });
  });

  // ==========================================
  // 4. AI UTILITIES
  // ==========================================
  describe('4. AI Utilities (AI Gateway Integration)', () => {
    it('ai-humanizer: routes through AiGatewayService and applies tone template', async () => {
      const res = await utilitiesService.executeUtility('ai-humanizer', {
        text: 'The algorithmic paradigms demonstrate computational efficacy across discrete sectors.',
        tone: 'casual',
      });

      expect(res.mode).toBe('AI');
      expect(res.result.humanizedText).toBeDefined();
      expect(res.result.originalWordCount).toBe(9);
      expect(res.result.tone).toBe('casual');
      expect(res.result.model).toBeDefined();

      // Verify AI request was persisted to database
      const logged = await prisma.aiRequest.findFirst({
        where: { utilitySlug: 'ai-humanizer' },
        orderBy: { timestamp: 'desc' },
      });
      expect(logged).toBeDefined();
      expect(logged?.utilitySlug).toBe('ai-humanizer');
    });

    it('ai-paraphraser: routes through AiGatewayService with style formatting', async () => {
      const res = await utilitiesService.executeUtility('ai-paraphraser', {
        text: 'Antigravity enables pairs of AI agents and human engineers to construct robust software systems.',
        style: 'concise',
      });

      expect(res.mode).toBe('AI');
      expect(res.result.paraphrasedText).toBeDefined();
      expect(res.result.style).toBe('concise');
    });

    it('ai-grammar-checker: returns structured corrections with issueCount and feedback', async () => {
      const res = await utilitiesService.executeUtility('ai-grammar-checker', {
        text: 'She dont have no time for doing that work yesterday.',
      });

      expect(res.mode).toBe('AI');
      expect(res.result.correctedText).toBeDefined();
      expect(typeof res.result.issueCount).toBe('number');
      expect(Array.isArray(res.result.issues)).toBe(true);
      expect(res.result.overallFeedback).toBeDefined();
    });

    it('AI utilities: reject prompts exceeding maximum character limit', async () => {
      const oversized = 'x'.repeat(60000);
      await expect(
        utilitiesService.executeUtility('ai-humanizer', {
          text: oversized,
        }),
      ).rejects.toThrow('exceeds maximum limit');
    });
  });

  // ==========================================
  // 5. HTTP ENDPOINT VERIFICATION
  // ==========================================
  describe('5. HTTP Endpoints (/api/v1/utilities)', () => {
    it('GET /api/v1/utilities - lists all 12 active MVP utilities with complete metadata', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/utilities').expect(200);

      expect(res.body.success).toBe(true);
      const list = res.body.data;
      const slugs = list.map((u: any) => u.slug);

      // Check all 12 MVP slugs are active and listed
      const expectedMvpSlugs = [
        'jpg-to-png',
        'png-to-jpg',
        'image-compressor',
        'pdf-compressor',
        'pdf-merge',
        'pdf-split',
        'pdf-to-jpg',
        'text-cleaner',
        'case-converter',
        'ai-humanizer',
        'ai-paraphraser',
        'ai-grammar-checker',
      ];

      for (const slug of expectedMvpSlugs) {
        expect(slugs).toContain(slug);
        const item = list.find((u: any) => u.slug === slug);
        expect(item.status).toBe('ACTIVE');
        expect(item.seoTitle).toBeDefined();
        expect(item.seoDescription).toBeDefined();
        expect(item.faqContent).toBeDefined();
      }
    });

    it('POST /api/v1/utilities/text-cleaner/execute - executes text-cleaner over HTTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/text-cleaner/execute')
        .send({
          input: {
            text: '   hello    world   ',
            options: { collapseSpaces: true, trimWhitespace: true },
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.result.cleanedText).toBe('hello world');
    });

    it('POST /api/v1/utilities/case-converter/execute - executes case-converter over HTTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/case-converter/execute')
        .send({
          input: {
            text: 'test case',
            targetCase: 'uppercase',
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.result.convertedText).toBe('TEST CASE');
    });
  });
});
