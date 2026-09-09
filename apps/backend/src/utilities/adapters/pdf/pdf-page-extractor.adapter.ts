import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfPageExtractorInput,
  PdfPageExtractorOutput,
} from '@ad-utility/shared';
import { PDFDocument } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfPageExtractorAdapter implements UtilityAdapter<PdfPageExtractorInput, PdfPageExtractorOutput> {
  readonly slug = 'pdf-page-extractor';
  readonly name = 'PDF Page Extractor';
  readonly description = 'Extract specific pages or page ranges from a PDF into a new standalone document';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 30 * 1024 * 1024, // 30MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfPageExtractorInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData" and "pageRanges"');
    }
    const { fileData, pageRanges, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    if (typeof pageRanges !== 'string' || pageRanges.trim().length === 0) {
      throw new Error('Property "pageRanges" is required (e.g. "1-3, 5, 8")');
    }

    return {
      fileData,
      pageRanges: pageRanges.trim(),
      filename: sanitizeFilename(filename, 'document', 'pdf'),
    };
  }

  async execute(input: PdfPageExtractorInput, _context: UtilityExecutionContext): Promise<PdfPageExtractorOutput> {
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
      throw new Error('Source PDF has 0 pages');
    }

    // Parse page ranges (e.g., "1-3, 5, 8")
    const targetPages = new Set<number>();
    const parts = input.pageRanges.split(',').map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
          throw new Error(`Invalid page range specification: "${part}"`);
        }
        for (let i = start; i <= Math.min(end, totalPages); i++) {
          targetPages.add(i);
        }
      } else {
        const p = parseInt(part, 10);
        if (isNaN(p) || p < 1) {
          throw new Error(`Invalid page number specification: "${part}"`);
        }
        if (p <= totalPages) {
          targetPages.add(p);
        }
      }
    }

    const sortedPages = Array.from(targetPages).sort((a, b) => a - b);
    if (sortedPages.length === 0) {
      throw new Error(`None of the requested pages exist in the document (document has ${totalPages} pages)`);
    }

    const destDoc = await PDFDocument.create();
    // 0-based indices for pdf-lib copyPages
    const indicesToCopy = sortedPages.map((p) => p - 1);
    const copiedPages = await destDoc.copyPages(srcDoc, indicesToCopy);

    for (const page of copiedPages) {
      destDoc.addPage(page);
    }

    const destBytes = await destDoc.save();
    const destBuffer = Buffer.from(destBytes);
    const dataUrl = bufferToDataUrl(destBuffer, 'application/pdf');

    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'document';
    const outFilename = `${baseName}_extracted_pages.pdf`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: destBuffer.length,
      extractedPages: sortedPages,
      pageCount: sortedPages.length,
    };
  }
}
