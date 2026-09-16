import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfMergeInput,
  PdfMergeOutput,
} from '@ad-utility/shared';
import { PDFDocument } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
} from '../utils/buffer-utils';

export class PdfMergeAdapter implements UtilityAdapter<PdfMergeInput, PdfMergeOutput> {
  readonly slug = 'pdf-merge';
  readonly name = 'PDF Merge';
  readonly description = 'Merge multiple PDF documents into a single cohesive document';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB combined
    maxBatchCount: 10,
    maxExecutionTimeMs: 45000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfMergeInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with a "files" array');
    }
    const { files } = input as any;
    if (!Array.isArray(files) || files.length < 2) {
      throw new Error('PDF merge requires at least 2 PDF files to combine');
    }
    const maxCount = this.resourceLimits?.maxBatchCount || 10;
    if (files.length > maxCount) {
      throw new Error(`Exceeded maximum limit of ${maxCount} PDF files to merge at once`);
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f || typeof f !== 'object' || typeof f.fileData !== 'string' || f.fileData.trim().length === 0) {
        throw new Error(`File at index ${i} is missing valid "fileData"`);
      }
    }

    return { files };
  }

  async execute(input: PdfMergeInput, _context: UtilityExecutionContext): Promise<PdfMergeOutput> {
    const mergedDoc = await PDFDocument.create();
    let totalCombinedBytes = 0;
    const maxCombinedBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;

    for (let i = 0; i < input.files.length; i++) {
      const fileItem = input.files[i];
      const { buffer } = parseBase64Payload(fileItem.fileData);

      totalCombinedBytes += buffer.length;
      if (totalCombinedBytes > maxCombinedBytes) {
        throw new Error(`Combined PDF size exceeds the 200MB limit`);
      }

      // Verify magic bytes
      validatePdfMagicBytes(buffer);

      let srcDoc: PDFDocument;
      try {
        srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      } catch (err: any) {
        throw new Error(`Failed to read PDF file #${i + 1} (${fileItem.filename || 'unnamed'}): ${err.message}`);
      }

      const pageCount = srcDoc.getPageCount();
      const pageIndices = Array.from({ length: pageCount }, (_, idx) => idx);
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);

      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    }

    const mergedBytes = await mergedDoc.save({ useObjectStreams: true });
    const mergedBuffer = Buffer.from(mergedBytes);

    return {
      dataUrl: bufferToDataUrl(mergedBuffer, 'application/pdf'),
      filename: `merged-document-${Date.now()}.pdf`,
      sizeBytes: mergedBuffer.length,
      totalPageCount: mergedDoc.getPageCount(),
      mergedFileCount: input.files.length,
    };
  }
}
