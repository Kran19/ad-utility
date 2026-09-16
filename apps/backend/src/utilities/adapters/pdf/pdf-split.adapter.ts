import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfSplitInput,
  PdfSplitOutput,
} from '@ad-utility/shared';
import { PDFDocument } from 'pdf-lib';
import * as JSZip from 'jszip';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfSplitAdapter implements UtilityAdapter<PdfSplitInput, PdfSplitOutput> {
  readonly slug = 'pdf-split';
  readonly name = 'PDF Split';
  readonly description = 'Extract specific pages and page ranges from PDF documents';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 25000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfSplitInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData" and "pageRanges"');
    }
    const { fileData, pageRanges, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }
    if (typeof pageRanges !== 'string' || pageRanges.trim().length === 0) {
      throw new Error('Property "pageRanges" is required (e.g. "1-3, 5, 8-10")');
    }

    return {
      fileData,
      pageRanges: pageRanges.trim(),
      filename: sanitizeFilename(filename, 'split', 'pdf'),
    };
  }

  async execute(input: PdfSplitInput, _context: UtilityExecutionContext): Promise<PdfSplitOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`PDF file size exceeds the 200MB limit`);
    }

    // Magic bytes verification
    validatePdfMagicBytes(buffer);

    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (err: any) {
      throw new Error(`Failed to read PDF document: ${err.message}`);
    }

    const totalPages = srcDoc.getPageCount();
    if (totalPages === 0) {
      throw new Error('PDF contains no pages');
    }

    // Parse page ranges (e.g. "1-3, 5, 8-10")
    const parsedPages = this.parsePageRanges(input.pageRanges, totalPages);
    if (parsedPages.length === 0) {
      throw new Error('No valid pages found in pageRanges specification');
    }

    // Build single extracted PDF containing all requested pages
    const splitDoc = await PDFDocument.create();
    const zeroBasedIndices = parsedPages.map((p) => p - 1);
    const copiedPages = await splitDoc.copyPages(srcDoc, zeroBasedIndices);

    for (const p of copiedPages) {
      splitDoc.addPage(p);
    }

    const outputBytes = await splitDoc.save({ useObjectStreams: true });
    const outputBuffer = Buffer.from(outputBytes);

    const outFilename = input.filename?.endsWith('.pdf')
      ? input.filename
      : `${input.filename?.replace(/\.[^/.]+$/, '') || 'split-document'}.pdf`;

    return {
      dataUrl: bufferToDataUrl(outputBuffer, 'application/pdf'),
      filename: outFilename,
      extractedPages: parsedPages,
      mimeType: 'application/pdf',
      sizeBytes: outputBuffer.length,
    };
  }

  /**
   * Parses expressions like "1-3, 5, 8-10" into sorted unique 1-indexed page numbers.
   */
  private parsePageRanges(expression: string, totalPages: number): number[] {
    const pages = new Set<number>();
    const tokens = expression.split(',').map((t) => t.trim()).filter(Boolean);

    for (const token of tokens) {
      if (token.includes('-')) {
        const parts = token.split('-').map((s) => s.trim());
        if (parts.length !== 2) {
          throw new Error(`Malformed range token: "${token}"`);
        }
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);

        if (isNaN(start) || isNaN(end)) {
          throw new Error(`Invalid range numbers in "${token}"`);
        }
        if (start < 1 || end < start) {
          throw new Error(`Invalid page range order: "${token}" (must be start <= end and >= 1)`);
        }
        if (start > totalPages) {
          throw new Error(`Page ${start} in range "${token}" exceeds document total of ${totalPages} pages`);
        }

        const boundedEnd = Math.min(end, totalPages);
        for (let p = start; p <= boundedEnd; p++) {
          pages.add(p);
        }
      } else {
        const singlePage = parseInt(token, 10);
        if (isNaN(singlePage) || singlePage < 1) {
          throw new Error(`Invalid page number: "${token}"`);
        }
        if (singlePage > totalPages) {
          throw new Error(`Page number ${singlePage} exceeds document total of ${totalPages} pages`);
        }
        pages.add(singlePage);
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }
}
