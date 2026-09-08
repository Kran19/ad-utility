import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfToJpgInput,
  PdfToJpgOutput,
} from '@ad-utility/shared';
import { createCanvas } from '@napi-rs/canvas';
import * as JSZip from 'jszip';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfToJpgAdapter implements UtilityAdapter<PdfToJpgInput, PdfToJpgOutput> {
  readonly slug = 'pdf-to-jpg';
  readonly name = 'PDF to JPG';
  readonly description = 'Convert PDF document pages to crisp high-resolution JPEG images';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
    maxExecutionTimeMs: 25000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfToJpgInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, page, scale, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    let parsedScale = 1.5;
    if (typeof scale === 'number') {
      parsedScale = Math.max(0.5, Math.min(3.0, scale));
    }

    return {
      fileData,
      page: page === 'all' || typeof page === 'number' ? page : 'all',
      scale: parsedScale,
      filename: sanitizeFilename(filename, 'document', 'pdf'),
    };
  }

  async execute(input: PdfToJpgInput, _context: UtilityExecutionContext): Promise<PdfToJpgOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 20971520;
    if (buffer.length > maxBytes) {
      throw new Error(`PDF file size exceeds the 20MB limit`);
    }

    // Magic bytes verification
    validatePdfMagicBytes(buffer);

    // Dynamically load modern legacy build of pdfjs-dist via native ESM loader
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const pdfjs = await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');

    let pdfDoc: any;
    try {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableWorker: true,
        isEvalSupported: false,
      });
      pdfDoc = await loadingTask.promise;
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }

    const totalPages = pdfDoc.numPages;
    if (totalPages === 0) {
      throw new Error('PDF contains no pages to render');
    }

    // Limit maximum pages to rasterize at once (prevent denial of service)
    const maxRenderPages = 20;
    let targetPages: number[] = [];

    if (input.page && input.page !== 'all') {
      const p = typeof input.page === 'number' ? input.page : parseInt(input.page, 10);
      if (isNaN(p) || p < 1 || p > totalPages) {
        throw new Error(`Page ${p} is out of bounds (document has ${totalPages} pages)`);
      }
      targetPages = [p];
    } else {
      const count = Math.min(totalPages, maxRenderPages);
      targetPages = Array.from({ length: count }, (_, idx) => idx + 1);
    }

    const renderedImages: Array<{ pageNum: number; buffer: Buffer }> = [];

    for (const pageNum of targetPages) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: input.scale || 1.5 });

      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');

      // Fill white background before rendering
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx as any,
        viewport,
      }).promise;

      const jpegBuffer = canvas.toBuffer('image/jpeg');
      renderedImages.push({ pageNum, buffer: jpegBuffer });
    }

    // If single page was rendered: return JPEG directly
    if (renderedImages.length === 1) {
      const single = renderedImages[0];
      const dataUrl = bufferToDataUrl(single.buffer, 'image/jpeg');
      const baseName = input.filename?.replace(/\.[^/.]+$/, '') || 'document';
      return {
        dataUrl,
        filename: `${baseName}-page-${single.pageNum}.jpg`,
        renderedPages: 1,
        sizeBytes: single.buffer.length,
        mimeType: 'image/jpeg',
      };
    }

    // Multiple pages: package into ZIP using JSZip
    const zip = new JSZip();
    const baseName = input.filename?.replace(/\.[^/.]+$/, '') || 'document';

    for (const item of renderedImages) {
      zip.file(`${baseName}-page-${item.pageNum}.jpg`, item.buffer);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return {
      dataUrl: bufferToDataUrl(zipBuffer, 'application/zip'),
      filename: `${baseName}-images.zip`,
      renderedPages: renderedImages.length,
      sizeBytes: zipBuffer.length,
      mimeType: 'application/zip',
    };
  }
}
