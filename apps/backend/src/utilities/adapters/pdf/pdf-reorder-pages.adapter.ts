import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfReorderInput,
  PdfReorderOutput,
} from '@ad-utility/shared';
import { PDFDocument } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfReorderPagesAdapter implements UtilityAdapter<PdfReorderInput, PdfReorderOutput> {
  readonly slug = 'pdf-reorder-pages';
  readonly name = 'PDF Reorder Pages';
  readonly description = 'Rearrange, sort, and remove PDF pages with visual drag-and-drop precision';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 30 * 1024 * 1024, // 30MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfReorderInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData" and "pageOrder"');
    }
    const { fileData, pageOrder, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
      throw new Error('Property "pageOrder" must be a non-empty array of page numbers');
    }

    const sanitizedOrder = pageOrder.map((n) => Math.round(Number(n))).filter((n) => n > 0);
    if (sanitizedOrder.length === 0) {
      throw new Error('No valid page numbers in pageOrder');
    }

    return {
      fileData,
      pageOrder: sanitizedOrder,
      filename: sanitizeFilename(filename, 'document', 'pdf'),
    };
  }

  async execute(input: PdfReorderInput, _context: UtilityExecutionContext): Promise<PdfReorderOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 31457280;
    if (buffer.length > maxBytes) {
      throw new Error(`PDF file size exceeds the 30MB limit`);
    }

    validatePdfMagicBytes(buffer);

    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (err: any) {
      throw new Error(`Failed to load PDF document: ${err.message}`);
    }

    const totalPages = srcDoc.getPageCount();
    if (totalPages === 0) {
      throw new Error('PDF document has 0 pages');
    }

    // Validate page numbers
    const validPages = input.pageOrder.filter((p) => p >= 1 && p <= totalPages);
    if (validPages.length === 0) {
      throw new Error(`None of the requested pages (${input.pageOrder.join(',')}) exist in the document (1-${totalPages})`);
    }

    const destDoc = await PDFDocument.create();
    const indicesToCopy = validPages.map((p) => p - 1);
    const copiedPages = await destDoc.copyPages(srcDoc, indicesToCopy);

    for (const page of copiedPages) {
      destDoc.addPage(page);
    }

    const destBytes = await destDoc.save();
    const destBuffer = Buffer.from(destBytes);
    const dataUrl = bufferToDataUrl(destBuffer, 'application/pdf');

    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'document';
    const outFilename = `${baseName}_reordered.pdf`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: destBuffer.length,
      pageCount: validPages.length,
    };
  }
}
