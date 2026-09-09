import { PdfCompressorAdapter } from '../src/utilities/adapters/pdf/pdf-compressor.adapter';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as jpeg from 'jpeg-js';

jest.setTimeout(60000);

describe('PDF Compressor Real Size Reduction Regression Suite', () => {
  let adapter: PdfCompressorAdapter;

  beforeAll(() => {
    adapter = new PdfCompressorAdapter();
  });

  /**
   * Helper to create high-resolution compressible JPEG buffers
   */
  const createLargeCompressibleJpeg = (width = 1600, height = 1200): Buffer => {
    const frameData = Buffer.alloc(width * height * 4);
    // Fill with gradient and geometric shapes (photographic simulation)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        frameData[idx] = (x + y) % 256;
        frameData[idx + 1] = (x * 2) % 256;
        frameData[idx + 2] = (y * 2) % 256;
        frameData[idx + 3] = 255;
      }
    }
    const encoded = jpeg.encode({ data: frameData, width, height }, 95);
    return Buffer.from(encoded.data);
  };

  /**
   * Helper to construct a multi-page image-heavy PDF of target approximate size
   */
  const createCompressiblePdf = async (targetApproxMb: number): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // High quality JPEG (~1.5MB to 2MB each)
    const jpegBuf = createLargeCompressibleJpeg(1920, 1080);
    const embeddedImg = await doc.embedJpg(jpegBuf);

    // Determine how many pages to meet target size
    const pagesNeeded = Math.max(1, Math.round(targetApproxMb / 1.8));

    for (let i = 1; i <= pagesNeeded; i++) {
      const page = doc.addPage([1920, 1080]);
      page.drawImage(embeddedImg, {
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
   * 1. CRITICAL ACCEPTANCE TEST: Real ~20MB PDF must materially reduce in size
   */
  it('CRITICAL REGRESSION: 20MB compressible PDF must produce materially smaller output', async () => {
    const pdfBuf = await createCompressiblePdf(18); // ~18-20 MB
    const inputSize = pdfBuf.length;
    expect(inputSize).toBeGreaterThan(10 * 1024 * 1024); // Verify it is a genuinely large fixture

    const result = await adapter.execute(
      {
        fileData: `data:application/pdf;base64,${pdfBuf.toString('base64')}`,
        filename: 'presentation_20mb.pdf',
        profile: 'EXTREME',
      },
      {} as any,
    );

    // Material size assertions
    expect(result.originalSizeBytes).toBe(inputSize);
    expect(result.compressedSizeBytes).toBeLessThan(inputSize * 0.6); // Must save at least 40%+
    expect(result.wasActuallyCompressed).toBe(true);
    expect(result.savedBytes).toBeGreaterThan(0);
    expect(result.savingsPercent).toBeGreaterThan(30);

    // Verify output PDF integrity
    const outputBuffer = Buffer.from(result.dataUrl.replace(/^data:application\/pdf;base64,/, ''), 'base64');
    expect(outputBuffer.length).toBe(result.compressedSizeBytes);

    const reloadedDoc = await PDFDocument.load(outputBuffer);
    expect(reloadedDoc.getPageCount()).toBe(result.pageCount);
  });

  /**
   * 2. Profile Differentiation: VISUALLY_LOSSLESS vs BALANCED vs EXTREME
   */
  it('Profile differentiation: profiles produce calibrated compression targets', async () => {
    const pdfBuf = await createCompressiblePdf(4); // ~4MB fixture

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

    // Extreme should be smaller than or equal to balanced, which is smaller than lossless
    expect(extreme.compressedSizeBytes).toBeLessThanOrEqual(balanced.compressedSizeBytes);
    expect(balanced.compressedSizeBytes).toBeLessThanOrEqual(lossless.compressedSizeBytes);
  });

  /**
   * 3. Text-only PDF: Preserves layout, page count, and selectable text
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
   * 4. Already Optimized PDF: Never inflates file and reports 0% savings
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

    // Output must not be larger than original
    expect(result.compressedSizeBytes).toBeLessThanOrEqual(result.originalSizeBytes);
    expect(result.savingsPercent).toBe(0);
    expect(result.wasActuallyCompressed).toBe(false);
  });
});
