import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfCompressorInput,
  PdfCompressorOutput,
  PdfCompressionLevel,
} from '@ad-utility/shared';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as zlib from 'zlib';
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
    maxExecutionTimeMs: 30000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfCompressorInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, filename, compressionLevel } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required (base64 or data URL)');
    }

    let validLevel: PdfCompressionLevel = 'extreme';
    if (compressionLevel === 'recommended' || compressionLevel === 'low' || compressionLevel === 'extreme') {
      validLevel = compressionLevel;
    }

    return {
      fileData,
      filename: sanitizeFilename(filename, 'compressed', 'pdf'),
      compressionLevel: validLevel,
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

    // Compression tuning: extreme defaults to aggressive reduction (KB to ~1MB)
    const level = input.compressionLevel || 'extreme';
    let maxDim = 1024;
    let quality = 35;

    if (level === 'recommended') {
      maxDim = 1280;
      quality = 50;
    } else if (level === 'low') {
      maxDim = 1600;
      quality = 70;
    }

    // Inspect and compress embedded image streams across the document
    try {
      for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
        if (obj && (obj as any).dict && (obj as any).dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
          const dict = (obj as any).dict;
          const filter = dict.get(PDFName.of('Filter'))?.toString();

          // 1. JPEG image streams (/Filter /DCTDecode)
          if (filter === '/DCTDecode') {
            try {
              const rawJpeg = Buffer.from((obj as any).getContents());
              // Validate JPEG SOI marker
              if (rawJpeg.length >= 2 && rawJpeg[0] === 0xff && rawJpeg[1] === 0xd8) {
                const loadedImg = await loadImage(rawJpeg);

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

                const compressedJpeg = await canvas.encode('jpeg', quality);

                if (compressedJpeg.length < rawJpeg.length) {
                  dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
                  dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
                  const newStream = PDFRawStream.of(dict, compressedJpeg);
                  doc.context.assign(ref, newStream);
                }
              }
            } catch {
              // Non-critical: skip individual stream on decode anomaly
            }
          }
          // 2. FlateDecode or uncompressed streams (often large PNG or raw bitmaps)
          else if (filter === '/FlateDecode' || !filter) {
            try {
              let uncompressedData: Buffer | null = null;
              if (filter === '/FlateDecode') {
                const rawContents = Buffer.from((obj as any).getContents());
                try {
                  uncompressedData = zlib.inflateSync(rawContents);
                } catch {
                  try {
                    uncompressedData = zlib.unzipSync(rawContents);
                  } catch {
                    uncompressedData = null;
                  }
                }
              } else {
                uncompressedData = Buffer.from((obj as any).getContents());
              }

              if (uncompressedData && uncompressedData.length >= 2) {
                // If it contains an encoded image format (e.g. JPEG, PNG)
                const isJpeg = uncompressedData[0] === 0xff && uncompressedData[1] === 0xd8;
                const isPng =
                  uncompressedData.length >= 8 &&
                  uncompressedData[0] === 0x89 &&
                  uncompressedData[1] === 0x50 &&
                  uncompressedData[2] === 0x4e &&
                  uncompressedData[3] === 0x47;

                if (isJpeg || isPng) {
                  const loadedImg = await loadImage(uncompressedData);
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

                  const compressedJpeg = await canvas.encode('jpeg', quality);
                  const prevLen = (obj as any).getContents().length;
                  if (compressedJpeg.length < prevLen) {
                    dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                    dict.delete(PDFName.of('DecodeParms'));
                    dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                    dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
                    dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
                    dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
                    const newStream = PDFRawStream.of(dict, compressedJpeg);
                    doc.context.assign(ref, newStream);
                  }
                }
              }
            } catch {
              // Non-critical: skip individual stream
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
