import { PdfCompressorAdapter } from '../src/utilities/adapters/pdf/pdf-compressor.adapter';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as jpeg from 'jpeg-js';
import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(120000);

describe('PDF Compressor Real Size Reduction Regression Suite', () => {
  let adapter: PdfCompressorAdapter;

  beforeAll(() => {
    adapter = new PdfCompressorAdapter();
  });

  /**
   * Helper to create high-resolution compressible JPEG buffers
   */
  const createLargeCompressibleJpeg = (width = 1600, height = 1200, seed = 0): Buffer => {
    const frameData = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        frameData[idx] = (x + y + seed * 17) % 256;
        frameData[idx + 1] = (x * 2 + seed * 31) % 256;
        frameData[idx + 2] = (y * 2 + seed * 43) % 256;
        frameData[idx + 3] = 255;
      }
    }
    const encoded = jpeg.encode({ data: frameData, width, height }, 95);
    return Buffer.from(encoded.data);
  };

  /**
   * Helper to construct a single-page heavy PDF
   */
  const createSinglePagePresentationPdf = async (): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const jpegBuf = createLargeCompressibleJpeg(2400, 1600, 1);
    const embeddedImg = await doc.embedJpg(jpegBuf);

    const page = doc.addPage([1920, 1080]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    page.drawText('Sample Illustrative Digital Marketing Strategy Presentation', {
      x: 80,
      y: 980,
      size: 36,
      font,
      color: rgb(1, 1, 1),
    });

    const savedBytes = await doc.save({ useObjectStreams: false });
    return Buffer.from(savedBytes);
  };

  /**
   * Helper to construct a multi-page image-heavy PDF
   */
  const createCompressiblePdf = async (pagesCount = 5): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= pagesCount; i++) {
      const page = doc.addPage([1920, 1080]);
      const jpegBuf = createLargeCompressibleJpeg(1600, 1200, i);
      const pageImg = await doc.embedJpg(jpegBuf);
      page.drawImage(pageImg, {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
      page.drawText(`Slide Deck Title - Page ${i}`, {
        x: 100,
        y: 1000,
        size: 32,
        font,
        color: rgb(1, 1, 1),
      });
    }

    const savedBytes = await doc.save({ useObjectStreams: false });
    return Buffer.from(savedBytes);
  };

  /**
   * 1. CRITICAL PRODUCTION REGRESSION: Exact 11.81MB presentation PDF under EXTREME profile
   * Must NOT fail with 11.07 MB (6.3% saved). Must achieve target <= 1.0 MB!
   */
  it('CRITICAL PRODUCTION REGRESSION: Exact 11.81MB presentation under EXTREME profile must reach <= 1.0 MB', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'real_presentation.pdf');
    if (!fs.existsSync(fixturePath)) {
      console.warn('Real presentation fixture not found, skipping real file test');
      return;
    }
    const pdfBuf = fs.readFileSync(fixturePath);
    const inputSize = pdfBuf.length;
    expect(inputSize).toBeGreaterThan(10 * 1024 * 1024); // verify ~11.81 MB fixture

    const result = await adapter.execute(
      {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        filename: 'Grey_and_Green_Illustrative_Digital_Marketing_Strategy_Presentation.pdf',
        profile: 'EXTREME',
      },
      {} as any,
    );

    // The test MUST fail if output remains ~11.07 MB (only 6.3% saved)
    expect(result.originalSizeBytes).toBe(inputSize);
    expect(result.savingsPercent).toBeGreaterThan(80); // Must save over 80%+
    expect(result.compressedSizeBytes).toBeLessThanOrEqual(1.0 * 1024 * 1024); // Must achieve <= 1.0 MB!
    expect(result.pageCount).toBe(1);
    expect(result.wasActuallyCompressed).toBe(true);

    const outputBuffer = Buffer.from(result.dataUrl.replace(/^data:application\/pdf;base64,/, ''), 'base64');
    expect(outputBuffer.length).toBe(result.compressedSizeBytes);

    const reloadedDoc = await PDFDocument.load(outputBuffer);
    expect(reloadedDoc.getPageCount()).toBe(1);
  });

  /**
   * 2. CRITICAL ACCEPTANCE TEST: 1-page ~10MB synthetic presentation under EXTREME profile
   */
  it('CRITICAL REGRESSION: 1-page synthetic presentation under EXTREME profile must reach <= 1.5MB', async () => {
    const pdfBuf = await createSinglePagePresentationPdf();
    const inputSize = pdfBuf.length;
    expect(inputSize).toBeGreaterThan(1 * 1024 * 1024);

    const result = await adapter.execute(
      {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        filename: 'synthetic_presentation.pdf',
        profile: 'EXTREME',
      },
      {} as any,
    );

    expect(result.originalSizeBytes).toBe(inputSize);
    expect(result.savingsPercent).toBeGreaterThan(50);
    expect(result.compressedSizeBytes).toBeLessThan(1.5 * 1024 * 1024);
    expect(result.pageCount).toBe(1);
    expect(result.wasActuallyCompressed).toBe(true);

    const outputBuffer = Buffer.from(result.dataUrl.replace(/^data:application\/pdf;base64,/, ''), 'base64');
    expect(outputBuffer.length).toBe(result.compressedSizeBytes);

    const reloadedDoc = await PDFDocument.load(outputBuffer);
    expect(reloadedDoc.getPageCount()).toBe(1);
  });

  /**
   * 3. CRITICAL ACCEPTANCE TEST: Multi-page image-heavy PDF must materially reduce in size
   */
  it('CRITICAL REGRESSION: Multi-page compressible PDF must produce materially smaller output', async () => {
    const pdfBuf = await createCompressiblePdf(8);
    const inputSize = pdfBuf.length;
    expect(inputSize).toBeGreaterThan(3 * 1024 * 1024);

    const result = await adapter.execute(
      {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        filename: 'presentation_20mb.pdf',
        profile: 'EXTREME',
      },
      {} as any,
    );

    expect(result.originalSizeBytes).toBe(inputSize);
    expect(result.compressedSizeBytes).toBeLessThan(inputSize * 0.5); // Must save at least 50%+
    expect(result.wasActuallyCompressed).toBe(true);
    expect(result.savedBytes).toBeGreaterThan(0);
    expect(result.savingsPercent).toBeGreaterThan(40);

    const outputBuffer = Buffer.from(result.dataUrl.replace(/^data:application\/pdf;base64,/, ''), 'base64');
    expect(outputBuffer.length).toBe(result.compressedSizeBytes);

    const reloadedDoc = await PDFDocument.load(outputBuffer);
    expect(reloadedDoc.getPageCount()).toBe(result.pageCount);
  });

  /**
   * 3. Profile Differentiation: VISUALLY_LOSSLESS vs BALANCED vs EXTREME
   */
  it('Profile differentiation: VISUALLY_LOSSLESS >= BALANCED >= EXTREME', async () => {
    const pdfBuf = await createCompressiblePdf(4);

    const lossless = await adapter.execute(
      {
        fileData: pdfBuf.toString('base64'),
        profile: 'VISUALLY_LOSSLESS',
      },
      {} as any,
    );

    const balanced = await adapter.execute(
      {
        fileData: pdfBuf.toString('base64'),
        profile: 'BALANCED',
      },
      {} as any,
    );

    const extreme = await adapter.execute(
      {
        fileData: pdfBuf.toString('base64'),
        profile: 'EXTREME',
      },
      {} as any,
    );

    expect(lossless.profile).toBe('VISUALLY_LOSSLESS');
    expect(balanced.profile).toBe('BALANCED');
    expect(extreme.profile).toBe('EXTREME');

    expect(extreme.compressedSizeBytes).toBeLessThanOrEqual(balanced.compressedSizeBytes);
    expect(balanced.compressedSizeBytes).toBeLessThanOrEqual(lossless.compressedSizeBytes);
  });

  /**
   * 4. Text-only PDF: Preserves document structure and text content
   */
  it('Text-only PDF: preserves document structure and text content', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 800]);
    page.drawText('Sample Legal Document Text Line 1', { x: 50, y: 700, size: 14, font });
    page.drawText('Sample Legal Document Text Line 2', { x: 50, y: 650, size: 14, font });
    const textPdfBuf = Buffer.from(await doc.save());

    const result = await adapter.execute(
      {
        fileData: textPdfBuf.toString('base64'),
        filename: 'text_doc.pdf',
        profile: 'VISUALLY_LOSSLESS',
      },
      {} as any,
    );

    expect(result.pageCount).toBe(1);
    const outBuf = Buffer.from(result.dataUrl.replace(/^data:application\/pdf;base64,/, ''), 'base64');
    const outDoc = await PDFDocument.load(outBuf);
    expect(outDoc.getPageCount()).toBe(1);
    expect(outDoc.getPage(0).getWidth()).toBe(600);
    expect(outDoc.getPage(0).getHeight()).toBe(800);
  });

  /**
   * 5. Already Optimized PDF: Never inflates file and reports 0% savings
   */
  it('Already optimized PDF: does not return a larger file and reports 0% saved', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const minimalBytes = Buffer.from(await doc.save({ useObjectStreams: true }));

    const result = await adapter.execute(
      {
        fileData: minimalBytes.toString('base64'),
        filename: 'minimal.pdf',
        profile: 'VISUALLY_LOSSLESS',
      },
      {} as any,
    );

    expect(result.compressedSizeBytes).toBeLessThanOrEqual(result.originalSizeBytes);
    expect(result.savingsPercent).toBe(0);
    expect(result.wasActuallyCompressed).toBe(false);
  });
});
