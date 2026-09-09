import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfCompressorInput,
  PdfCompressorOutput,
} from '@ad-utility/shared';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfCompressorAdapter implements UtilityAdapter<PdfCompressorInput, PdfCompressorOutput> {
  readonly slug = 'pdf-compressor';
  readonly name = 'PDF Compressor';
  readonly description = 'Optimize and reduce PDF document size with stream compression and image optimization';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 25 * 1024 * 1024, // 25MB
    maxExecutionTimeMs: 25000,
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

    // Inspect and compress embedded image streams across the document
    try {
      for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
        if (obj && (obj as any).dict && (obj as any).dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
          const filter = (obj as any).dict.get(PDFName.of('Filter'))?.toString();
          if (filter === '/DCTDecode') {
            try {
              const rawJpeg = Buffer.from((obj as any).getContents());
              // Validate JPEG SOI marker
              if (rawJpeg.length >= 2 && rawJpeg[0] === 0xff && rawJpeg[1] === 0xd8) {
                const loadedImg = await loadImage(rawJpeg);

                // Cap oversized embedded images to 1600px max dimension to eliminate multi-megabyte bloated slides
                const maxDim = 1600;
                let targetW = loadedImg.width;
                let targetH = loadedImg.height;
                if (targetW > maxDim || targetH > maxDim) {
                  const ratio = Math.min(maxDim / targetW, maxDim / targetH);
                  targetW = Math.max(1, Math.round(targetW * ratio));
                  targetH = Math.max(1, Math.round(targetH * ratio));
                }

                const canvas = createCanvas(targetW, targetH);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(loadedImg, 0, 0, targetW, targetH);

                // Re-encode at 65% quality (excellent visual quality, dramatic byte reduction)
                const compressedJpeg = await canvas.encode('jpeg', 65);

                if (compressedJpeg.length < rawJpeg.length) {
                  (obj as any).dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
                  (obj as any).dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
                  const newStream = PDFRawStream.of((obj as any).dict, compressedJpeg);
                  doc.context.assign(ref, newStream);
                }
              }
            } catch {
              // Non-critical: skip individual stream on decode anomaly
            }
          }
        }
      }
    } catch {
      // Non-critical: continue with structure compression if stream traversal fails
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
