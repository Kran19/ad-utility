import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfCompressorInput,
  PdfCompressorOutput,
} from '@ad-utility/shared';
import { PDFDocument } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfCompressorAdapter implements UtilityAdapter<PdfCompressorInput, PdfCompressorOutput> {
  readonly slug = 'pdf-compressor';
  readonly name = 'PDF Compressor';
  readonly description = 'Optimize and reduce PDF document size with stream compression';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 25 * 1024 * 1024, // 25MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfCompressorInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required (base64 or data URL)');
    }

    return {
      fileData,
      filename: sanitizeFilename(filename, 'compressed', 'pdf'),
    };
  }

  async execute(input: PdfCompressorInput, _context: UtilityExecutionContext): Promise<PdfCompressorOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 26214400;
    if (buffer.length > maxBytes) {
      throw new Error(`PDF file size (${Math.round(buffer.length / (1024 * 1024))}MB) exceeds the 25MB limit`);
    }

    // Authoritative magic bytes verification
    validatePdfMagicBytes(buffer);

    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }

    const pageCount = doc.getPageCount();
    if (pageCount === 0) {
      throw new Error('PDF contains zero pages');
    }

    // Save with object streams and clean up unreferenced objects
    const compressedUint8 = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const compressedBuffer = Buffer.from(compressedUint8);
    const originalSize = buffer.length;
    const compressedSize = compressedBuffer.length;

    // Use smaller of the two if original was already packed tighter
    const finalBuffer = compressedSize < originalSize ? compressedBuffer : buffer;
    const finalSize = finalBuffer.length;
    const savingsBytes = Math.max(0, originalSize - finalSize);
    const savingsPercent = originalSize > 0 ? Math.round((savingsBytes / originalSize) * 1000) / 10 : 0;

    const outFilename = input.filename?.endsWith('.pdf')
      ? input.filename
      : `${input.filename?.replace(/\.[^/.]+$/, '') || 'compressed'}.pdf`;

    return {
      dataUrl: bufferToDataUrl(finalBuffer, 'application/pdf'),
      filename: outFilename,
      originalSizeBytes: originalSize,
      compressedSizeBytes: finalSize,
      savingsPercent,
      pageCount,
    };
  }
}
