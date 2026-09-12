import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { PDFDocument } from 'pdf-lib';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import * as JSZip from 'jszip';

jest.setTimeout(45000);

describe('Phase 27 — Wave 1 Utilities Verification', () => {
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
        png.data[idx] = 100;
        png.data[idx + 1] = 150;
        png.data[idx + 2] = 200;
        png.data[idx + 3] = 255;
      }
    }
    return PNG.sync.write(png);
  };

  const createTestPdfBuffer = async (pageCount = 3): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    for (let i = 1; i <= pageCount; i++) {
      const page = doc.addPage([400, 400]);
      page.drawText(`Hello World Page ${i}`);
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
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 1. IMAGE TO PDF
  // ==========================================
  describe('1. Image to PDF (image-to-pdf)', () => {
    it('should convert single JPEG to PDF successfully', async () => {
      const jpegBuf = createTestJpegBuffer(50, 50);
      const res = await utilitiesService.executeUtility('image-to-pdf', {
        fileData: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`,
        pageSize: 'A4',
        filename: 'photos.jpg',
      });

      expect(res.mode).toBe('SERVER');
      expect(res.result.dataUrl).toMatch(/^data:application\/pdf;base64,/);
      expect(res.result.pageCount).toBe(1);
      expect(res.result.filename).toBe('photos.pdf');
      expect(res.result.sizeBytes).toBeGreaterThan(0);
    });

    it('should combine multiple images into a multi-page PDF', async () => {
      const jpegBuf = createTestJpegBuffer(30, 30);
      const pngBuf = createTestPngBuffer(40, 40);

      const res = await utilitiesService.executeUtility('image-to-pdf', {
        images: [
          { fileData: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`, filename: 'img1.jpg' },
          { fileData: `data:image/png;base64,${pngBuf.toString('base64')}`, filename: 'img2.png' },
        ],
        pageSize: 'LETTER',
        orientation: 'LANDSCAPE',
        filename: 'combined.pdf',
      });

      expect(res.result.pageCount).toBe(2);
      expect(res.result.filename).toBe('combined.pdf');

      // Verify the generated PDF has 2 pages
      const rawB64 = res.result.dataUrl.replace(/^data:application\/pdf;base64,/, '');
      const doc = await PDFDocument.load(Buffer.from(rawB64, 'base64'));
      expect(doc.getPageCount()).toBe(2);
    });

    it('should reject invalid payload with no images', async () => {
      await expect(
        utilitiesService.executeUtility('image-to-pdf', { images: [] }),
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // 2. IMAGE RESIZER
  // ==========================================
  describe('2. Image Resizer (image-resizer)', () => {
    it('should resize image to target dimensions while maintaining aspect ratio', async () => {
      const pngBuf = createTestPngBuffer(100, 50);
      const res = await utilitiesService.executeUtility('image-resizer', {
        fileData: `data:image/png;base64,${pngBuf.toString('base64')}`,
        width: 50,
        maintainAspectRatio: true,
        format: 'image/png',
      });

      expect(res.result.newWidth).toBe(50);
      expect(res.result.newHeight).toBe(25);
      expect(res.result.originalWidth).toBe(100);
      expect(res.result.originalHeight).toBe(50);
    });

    it('should resize image with percentage scale', async () => {
      const jpegBuf = createTestJpegBuffer(80, 80);
      const res = await utilitiesService.executeUtility('image-resizer', {
        fileData: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`,
        scalePercent: 50,
        format: 'image/jpeg',
      });

      expect(res.result.newWidth).toBe(40);
      expect(res.result.newHeight).toBe(40);
    });
  });

  // ==========================================
  // 3. IMAGE CROPPER
  // ==========================================
  describe('3. Image Cropper (image-cropper)', () => {
    it('should crop image to specified rectangular region', async () => {
      const pngBuf = createTestPngBuffer(100, 100);
      const res = await utilitiesService.executeUtility('image-cropper', {
        fileData: `data:image/png;base64,${pngBuf.toString('base64')}`,
        x: 10,
        y: 10,
        width: 50,
        height: 40,
        format: 'image/png',
      });

      expect(res.result.width).toBe(50);
      expect(res.result.height).toBe(40);
      expect(res.result.sizeBytes).toBeGreaterThan(0);
    });

    it('should safely default to full image bounds when width and height are omitted or zero', async () => {
      const pngBuf = createTestPngBuffer(120, 80);
      const res = await utilitiesService.executeUtility('image-cropper', {
        fileData: `data:image/png;base64,${pngBuf.toString('base64')}`,
        // No width/height or x/y passed (e.g. user clicked Run immediately)
      });

      expect(res.result.width).toBe(120);
      expect(res.result.height).toBe(80);
      expect(res.result.sizeBytes).toBeGreaterThan(0);
    });

    it('should clamp out-of-bounds crop coordinates safely to image edges', async () => {
      const pngBuf = createTestPngBuffer(100, 100);
      const res = await utilitiesService.executeUtility('image-cropper', {
        fileData: `data:image/png;base64,${pngBuf.toString('base64')}`,
        x: 80,
        y: 80,
        width: 150, // exceeds right edge
        height: 150, // exceeds bottom edge
      });

      // Clamped width: 100 - 80 = 20, Clamped height: 100 - 80 = 20
      expect(res.result.width).toBe(20);
      expect(res.result.height).toBe(20);
      expect(res.result.sizeBytes).toBeGreaterThan(0);
    });

    it('should support rotation during crop', async () => {
      const pngBuf = createTestPngBuffer(100, 100);
      const res = await utilitiesService.executeUtility('image-cropper', {
        fileData: `data:image/png;base64,${pngBuf.toString('base64')}`,
        x: 0,
        y: 0,
        width: 60,
        height: 30,
        rotateDegrees: 90,
      });

      expect(res.result.width).toBe(30);
      expect(res.result.height).toBe(60);
    });
  });

  // ==========================================
  // 4. PDF TO PNG
  // ==========================================
  describe('4. PDF to PNG (pdf-to-png)', () => {
    it('should render multi-page PDF to PNGs packaged as a ZIP', async () => {
      const pdfBuf = await createTestPdfBuffer(2);
      const res = await utilitiesService.executeUtility('pdf-to-png', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        scale: 1.0,
      });

      expect(res.result.pageCount).toBe(2);
      expect(res.result.isZip).toBe(true);
      expect(res.result.filename).toContain('.zip');
      expect(res.result.pages.length).toBe(2);

      // Verify ZIP contains valid PNG files
      const rawB64 = res.result.dataUrl.replace(/^data:application\/zip;base64,/, '');
      const zip = await JSZip.loadAsync(Buffer.from(rawB64, 'base64'));
      const fileNames = Object.keys(zip.files);
      expect(fileNames.length).toBe(2);
      expect(fileNames[0]).toMatch(/\.png$/);
    });
  });

  // ==========================================
  // 5. PDF TO TEXT
  // ==========================================
  describe('5. PDF to Text (pdf-to-text)', () => {
    it('should extract text lines from PDF document', async () => {
      const pdfBuf = await createTestPdfBuffer(2);
      const res = await utilitiesService.executeUtility('pdf-to-text', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
      });

      expect(res.result.pageCount).toBe(2);
      expect(res.result.text).toContain('Page 1');
      expect(res.result.text).toContain('Page 2');
      expect(res.result.hasSelectableText).toBe(true);
      expect(res.result.wordCount).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 6. PDF PAGE EXTRACTOR
  // ==========================================
  describe('6. PDF Page Extractor (pdf-page-extractor)', () => {
    it('should extract specified page range into a new PDF', async () => {
      const pdfBuf = await createTestPdfBuffer(4);
      const res = await utilitiesService.executeUtility('pdf-page-extractor', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        pageRanges: '1, 3-4',
      });

      expect(res.result.pageCount).toBe(3);
      expect(res.result.extractedPages).toEqual([1, 3, 4]);

      const rawB64 = res.result.dataUrl.replace(/^data:application\/pdf;base64,/, '');
      const doc = await PDFDocument.load(Buffer.from(rawB64, 'base64'));
      expect(doc.getPageCount()).toBe(3);
    });

    it('should reject invalid page ranges gracefully', async () => {
      const pdfBuf = await createTestPdfBuffer(2);
      await expect(
        utilitiesService.executeUtility('pdf-page-extractor', {
          fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
          pageRanges: '10-20',
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // 7. PDF ROTATOR
  // ==========================================
  describe('7. PDF Rotator (pdf-rotator)', () => {
    it('should rotate all PDF pages by 90 degrees', async () => {
      const pdfBuf = await createTestPdfBuffer(2);
      const res = await utilitiesService.executeUtility('pdf-rotator', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        angle: 90,
        pages: 'ALL',
      });

      expect(res.result.pageCount).toBe(2);
      expect(res.result.rotatedAngle).toBe(90);

      const rawB64 = res.result.dataUrl.replace(/^data:application\/pdf;base64,/, '');
      const doc = await PDFDocument.load(Buffer.from(rawB64, 'base64'));
      expect(doc.getPages()[0].getRotation().angle).toBe(90);
    });
  });

  // ==========================================
  // 8. PDF REORDER PAGES
  // ==========================================
  describe('8. PDF Reorder Pages (pdf-reorder-pages)', () => {
    it('should reorder pages in custom specified order', async () => {
      const pdfBuf = await createTestPdfBuffer(3);
      const res = await utilitiesService.executeUtility('pdf-reorder-pages', {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        pageOrder: [3, 1],
      });

      expect(res.result.pageCount).toBe(2);

      const rawB64 = res.result.dataUrl.replace(/^data:application\/pdf;base64,/, '');
      const doc = await PDFDocument.load(Buffer.from(rawB64, 'base64'));
      expect(doc.getPageCount()).toBe(2);
    });
  });
});
