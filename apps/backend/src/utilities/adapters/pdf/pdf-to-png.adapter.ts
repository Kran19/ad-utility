import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfToPngInput,
  PdfToPngOutput,
} from '@ad-utility/shared';
import { createCanvas } from '@napi-rs/canvas';
import * as JSZip from 'jszip';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfToPngAdapter implements UtilityAdapter<PdfToPngInput, PdfToPngOutput> {
  readonly slug = 'pdf-to-png';
  readonly name = 'PDF to PNG';
  readonly description = 'Convert PDF document pages to crisp, high-resolution PNG images';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 25 * 1024 * 1024, // 25MB
    maxExecutionTimeMs: 25000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfToPngInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, scale, maxPages, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    let parsedScale = 1.5;
    if (typeof scale === 'number') {
      parsedScale = Math.max(0.5, Math.min(3.0, scale));
    }

    return {
      fileData,
      scale: parsedScale,
      maxPages: typeof maxPages === 'number' && maxPages > 0 ? Math.min(50, maxPages) : 20,
      filename: sanitizeFilename(filename, 'document', 'pdf'),
    };
  }

  async execute(input: PdfToPngInput, _context: UtilityExecutionContext): Promise<PdfToPngOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 26214400;
    if (buffer.length > maxBytes) {
      throw new Error(`PDF file size exceeds the 25MB limit`);
    }

    validatePdfMagicBytes(buffer);

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

    const pageLimit = Math.min(totalPages, input.maxPages || 20);
    const pages: Array<{ pageNumber: number; dataUrl: string; buffer: Buffer }> = [];

    for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: input.scale || 1.5 });

      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx as any,
        viewport,
      }).promise;

      const pngBuffer = canvas.toBuffer('image/png');
      pages.push({
        pageNumber: pageNum,
        dataUrl: bufferToDataUrl(pngBuffer, 'image/png'),
        buffer: pngBuffer,
      });
    }

    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'document';

    // If 1 page, return single PNG directly. If multiple, generate ZIP
    if (pages.length === 1) {
      const single = pages[0];
      return {
        dataUrl: single.dataUrl,
        filename: `${baseName}.png`,
        sizeBytes: single.buffer.length,
        pageCount: 1,
        isZip: false,
        pages: [{ pageNumber: 1, dataUrl: single.dataUrl }],
      };
    }

    const zip = new JSZip();
    for (const p of pages) {
      const paddedIndex = String(p.pageNumber).padStart(3, '0');
      zip.file(`${baseName}_page_${paddedIndex}.png`, p.buffer);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const dataUrl = bufferToDataUrl(zipBuffer, 'application/zip');

    return {
      dataUrl,
      filename: `${baseName}_png_pages.zip`,
      sizeBytes: zipBuffer.length,
      pageCount: pages.length,
      isZip: true,
      pages: pages.map((p) => ({ pageNumber: p.pageNumber, dataUrl: p.dataUrl })),
    };
  }
}
