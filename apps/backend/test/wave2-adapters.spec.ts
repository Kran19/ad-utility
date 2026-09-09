import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { PDFDocument } from 'pdf-lib';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { createCanvas } from '@napi-rs/canvas';

jest.setTimeout(45000);

describe('Phase 27 — Wave 2 Utilities Verification', () => {
  let app: INestApplication;
  let utilitiesService: UtilitiesService;

  const createTestJpegBuffer = (width = 40, height = 40): Buffer => {
    const frameData = Buffer.alloc(width * height * 4, 180);
    const jpegData = jpeg.encode({ data: frameData, width, height }, 85);
    return Buffer.from(jpegData.data);
  };

  const createTestPngBuffer = (width = 40, height = 40): Buffer => {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = 120;
        png.data[idx + 1] = 160;
        png.data[idx + 2] = 220;
        png.data[idx + 3] = 200;
      }
    }
    return PNG.sync.write(png);
  };

  const createTestWebpBuffer = (width = 40, height = 40): Buffer => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, width, height);
    return canvas.toBuffer('image/webp', { quality: 0.8 });
  };

  const createTestPdfWithMetadataBuffer = async (): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    doc.setTitle('Secret Confidential Report');
    doc.setAuthor('John Doe');
    doc.setSubject('Internal Audit');
    doc.setKeywords(['confidential', 'financial']);
    doc.setProducer('Internal System v1.0');
    doc.setCreator('Report Generator');

    const page = doc.addPage([400, 400]);
    page.drawText('Confidential document content');

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
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 1. WEBP TO JPG
  // ==========================================
  describe('1. WebP to JPG (webp-to-jpg)', () => {
    it('should convert WebP to JPG with clean background compositing', async () => {
      const webpBuf = createTestWebpBuffer(50, 50);
      const res = await utilitiesService.executeUtility('webp-to-jpg', {
        fileData: `data:image/webp;base64,${webpBuf.toString('base64')}`,
        quality: 90,
        backgroundColor: '#FFFFFF',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(res.result.width).toBe(50);
      expect(res.result.height).toBe(50);
      expect(res.result.sizeBytes).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 2. JPG TO WEBP
  // ==========================================
  describe('2. JPG to WebP (jpg-to-webp)', () => {
    it('should convert JPEG to WebP format', async () => {
      const jpegBuf = createTestJpegBuffer(50, 50);
      const res = await utilitiesService.executeUtility('jpg-to-webp', {
        fileData: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`,
        quality: 80,
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:image\/webp;base64,/);
      expect(res.result.width).toBe(50);
      expect(res.result.height).toBe(50);
      expect(res.result.sizeBytes).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 3. PNG TO WEBP
  // ==========================================
  describe('3. PNG to WebP (png-to-webp)', () => {
    it('should convert PNG to WebP while preserving dimensions', async () => {
      const pngBuf = createTestPngBuffer(50, 50);
      const res = await utilitiesService.executeUtility('png-to-webp', {
        fileData: `data:image/png;base64,${pngBuf.toString('base64')}`,
        quality: 85,
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:image\/webp;base64,/);
      expect(res.result.width).toBe(50);
      expect(res.result.height).toBe(50);
    });
  });

  // ==========================================
  // 4. PDF WATERMARK
  // ==========================================
  describe('4. PDF Watermark (pdf-watermark)', () => {
    it('should overlay text watermark across PDF pages', async () => {
      const pdfBuf = await createTestPdfWithMetadataBuffer();
      const res = await utilitiesService.executeUtility('pdf-watermark', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        watermarkText: 'CONFIDENTIAL DRAFT',
        opacity: 0.4,
        position: 'DIAGONAL',
      });

      expect(res.result.pageCount).toBe(1);
      expect(res.result.dataUrl).toMatch(/^data:application\/pdf;base64,/);

      const rawB64 = res.result.dataUrl.replace(/^data:application\/pdf;base64,/, '');
      const doc = await PDFDocument.load(Buffer.from(rawB64, 'base64'));
      expect(doc.getPageCount()).toBe(1);
    });
  });

  // ==========================================
  // 5. PDF METADATA REMOVER
  // ==========================================
  describe('5. PDF Metadata Remover (pdf-metadata-remover)', () => {
    it('should strip document metadata properties safely', async () => {
      const pdfBuf = await createTestPdfWithMetadataBuffer();
      const res = await utilitiesService.executeUtility('pdf-metadata-remover', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
      });

      expect(res.result.removedFields.length).toBeGreaterThan(0);

      const rawB64 = res.result.dataUrl.replace(/^data:application\/pdf;base64,/, '');
      const doc = await PDFDocument.load(Buffer.from(rawB64, 'base64'));

      expect(doc.getTitle()).toBeFalsy();
      expect(doc.getAuthor()).toBeFalsy();
      expect(doc.getSubject()).toBeFalsy();
    });
  });
});
