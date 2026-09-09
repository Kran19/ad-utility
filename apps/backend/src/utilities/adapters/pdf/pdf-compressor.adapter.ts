import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfCompressorInput,
  PdfCompressorOutput,
  PdfCompressionProfile,
} from '@ad-utility/shared';
import { Logger } from '@nestjs/common';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import * as zlib from 'zlib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

interface ImageClassification {
  isPhotographic: boolean;
  hasAlpha: boolean;
}

interface ProfileSettings {
  maxDimension: number;
  jpegQuality: number;
  downsamplePhotographicOnly: boolean;
  allowLossyDiagrams: boolean;
}

const PROFILE_CONFIGS: Record<PdfCompressionProfile, ProfileSettings> = {
  VISUALLY_LOSSLESS: {
    maxDimension: 2048,
    jpegQuality: 82,
    downsamplePhotographicOnly: true,
    allowLossyDiagrams: false,
  },
  BALANCED: {
    maxDimension: 1440,
    jpegQuality: 68,
    downsamplePhotographicOnly: true,
    allowLossyDiagrams: false,
  },
  EXTREME: {
    maxDimension: 1080,
    jpegQuality: 52,
    downsamplePhotographicOnly: false,
    allowLossyDiagrams: false, // Diagrams/text screenshots still preserved against JPEG ringing
  },
};

export class PdfCompressorAdapter implements UtilityAdapter<PdfCompressorInput, PdfCompressorOutput> {
  private readonly logger = new Logger(PdfCompressorAdapter.name);

  readonly slug = 'pdf-compressor';
  readonly name = 'PDF Compressor';
  readonly description = 'Multi-stage PDF optimizer with content classification and adaptive stream compression';
  readonly version = '2.0.0';
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
    const { fileData, filename, profile, compressionLevel } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required (base64 or data URL)');
    }

    // Resolve profile (support both modern profile and legacy compressionLevel)
    let validProfile: PdfCompressionProfile = 'VISUALLY_LOSSLESS';
    const candidateProfile = (profile || '').toUpperCase();
    if (
      candidateProfile === 'VISUALLY_LOSSLESS' ||
      candidateProfile === 'BALANCED' ||
      candidateProfile === 'EXTREME'
    ) {
      validProfile = candidateProfile as PdfCompressionProfile;
    } else if (compressionLevel === 'extreme') {
      validProfile = 'EXTREME';
    } else if (compressionLevel === 'recommended') {
      validProfile = 'BALANCED';
    } else if (compressionLevel === 'low') {
      validProfile = 'VISUALLY_LOSSLESS';
    }

    return {
      fileData,
      filename: sanitizeFilename(filename, 'compressed', 'pdf'),
      profile: validProfile,
    };
  }

  async execute(input: PdfCompressorInput, _context: UtilityExecutionContext): Promise<PdfCompressorOutput> {
    const { buffer } = parseBase64Payload(input.fileData);
    const originalSize = buffer.length;

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 26214400;
    if (originalSize > maxBytes) {
      throw new Error(`PDF file size (${Math.round(originalSize / (1024 * 1024))}MB) exceeds the 25MB limit`);
    }

    validatePdfMagicBytes(buffer);

    const profile = input.profile || 'VISUALLY_LOSSLESS';
    const settings = PROFILE_CONFIGS[profile] || PROFILE_CONFIGS.VISUALLY_LOSSLESS;

    // Load source document
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

    // Stage 1: Structural catalog optimization
    this.cleanStructuralMetadata(doc);

    // Stage 2: Intelligent content-aware image optimization
    const imageStats = await this.optimizeImageStreams(doc, settings);

    // Stage 3: Fresh serialization with cross-reference object stream compaction
    let candidateBytes: Buffer;
    try {
      const serializedUint8 = await doc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });
      candidateBytes = Buffer.from(serializedUint8);
    } catch (saveErr: any) {
      this.logger.warn(`Initial serialization failed: ${saveErr.message}; falling back to original`);
      candidateBytes = buffer;
    }

    // Stage 4: Candidate measurement and validation
    let finalBuffer = buffer;
    let wasActuallyCompressed = false;
    let finalSize = originalSize;

    // Verify candidate is well-formed and materially smaller
    if (candidateBytes.length < originalSize) {
      try {
        // Validate candidate can be parsed cleanly
        const verificationDoc = await PDFDocument.load(candidateBytes, { ignoreEncryption: true });
        if (verificationDoc.getPageCount() === pageCount) {
          finalBuffer = candidateBytes;
          finalSize = candidateBytes.length;
          wasActuallyCompressed = true;
        }
      } catch (verifyErr: any) {
        this.logger.warn(`Candidate PDF verification failed: ${verifyErr.message}; preserving original`);
        finalBuffer = buffer;
        finalSize = originalSize;
        wasActuallyCompressed = false;
      }
    }

    const savedBytes = Math.max(0, originalSize - finalSize);
    const savingsPercent =
      originalSize > 0 && wasActuallyCompressed
        ? Math.round((savedBytes / originalSize) * 1000) / 10
        : 0;
    const compressionRatio =
      finalSize > 0 ? Math.round((originalSize / finalSize) * 100) / 100 : 1.0;

    this.logger.log(
      `utility=pdf-compressor profile=${profile} inputBytes=${originalSize} outputBytes=${finalSize} savedBytes=${savedBytes} savingsPercent=${savingsPercent}% ratio=${compressionRatio} images=${imageStats.total} optimized=${imageStats.optimized}`,
    );

    const outFilename = input.filename?.endsWith('.pdf')
      ? input.filename
      : `${input.filename?.replace(/\.[^/.]+$/, '') || 'compressed'}.pdf`;

    return {
      dataUrl: bufferToDataUrl(finalBuffer, 'application/pdf'),
      filename: outFilename,
      originalSizeBytes: originalSize,
      compressedSizeBytes: finalSize,
      savedBytes,
      savingsPercent,
      compressionRatio,
      profile,
      wasActuallyCompressed,
      pageCount,
    };
  }

  /**
   * Remove bloated unreferenced catalog metadata (XMP XML packets, edit histories)
   */
  private cleanStructuralMetadata(doc: PDFDocument): void {
    try {
      const catalog = doc.catalog;
      catalog.delete(PDFName.of('Metadata'));
      catalog.delete(PDFName.of('PieceInfo'));
      catalog.delete(PDFName.of('SpiderInfo'));
    } catch {
      // Non-critical: continue if catalog editing fails
    }
  }

  /**
   * Traverse indirect objects, detect image XObjects, classify, and optimize
   */
  private async optimizeImageStreams(
    doc: PDFDocument,
    settings: ProfileSettings,
  ): Promise<{ total: number; optimized: number }> {
    let totalImages = 0;
    let optimizedImages = 0;

    try {
      const objects = doc.context.enumerateIndirectObjects();
      for (const [ref, obj] of objects) {
        if (!obj || !(obj as any).dict) continue;

        const dict = (obj as any).dict;
        const subtype = dict.get(PDFName.of('Subtype'))?.toString();
        if (subtype !== '/Image') continue;

        totalImages++;

        try {
          const filter = dict.get(PDFName.of('Filter'))?.toString();
          const rawContents = Buffer.from((obj as any).getContents());

          // Unpack raw payload
          let decompressedBuffer: Buffer | null = null;
          let isDirectJpeg = false;

          if (filter === '/DCTDecode') {
            if (rawContents.length >= 2 && rawContents[0] === 0xff && rawContents[1] === 0xd8) {
              decompressedBuffer = rawContents;
              isDirectJpeg = true;
            }
          } else if (filter === '/FlateDecode' || !filter) {
            try {
              decompressedBuffer = filter === '/FlateDecode' ? zlib.inflateSync(rawContents) : rawContents;
            } catch {
              try {
                decompressedBuffer = zlib.unzipSync(rawContents);
              } catch {
                decompressedBuffer = null;
              }
            }
          }

          if (!decompressedBuffer || decompressedBuffer.length === 0) continue;

          // Decompression bomb safety: abort decode if dimensions exceed 40 megapixels
          const declaredW = dict.get(PDFName.of('Width'))?.numberValue;
          const declaredH = dict.get(PDFName.of('Height'))?.numberValue;
          if (declaredW && declaredH && declaredW * declaredH > 40_000_000) {
            continue;
          }

          // Check if buffer contains image container or raw bitmap
          let loadedImg: Image | null = null;
          try {
            if (
              (decompressedBuffer.length >= 2 && decompressedBuffer[0] === 0xff && decompressedBuffer[1] === 0xd8) ||
              (decompressedBuffer.length >= 8 && decompressedBuffer[0] === 0x89 && decompressedBuffer[1] === 0x50)
            ) {
              loadedImg = await loadImage(decompressedBuffer);
            }
          } catch {
            loadedImg = null;
          }

          if (!loadedImg) continue;

          const imgW = loadedImg.width;
          const imgH = loadedImg.height;
          if (imgW <= 0 || imgH <= 0) continue;

          // Classify image content: photographic vs line-art / diagram / text screenshot
          const classification = this.classifyImage(loadedImg);

          // Calculate target dimensions
          let targetW = imgW;
          let targetH = imgH;
          const maxDim = settings.maxDimension;

          if (imgW > maxDim || imgH > maxDim) {
            // If downsamplePhotographicOnly is true and image is line art/text, skip downsampling to keep text crisp
            if (!settings.downsamplePhotographicOnly || classification.isPhotographic) {
              const ratio = Math.min(maxDim / imgW, maxDim / imgH);
              targetW = Math.max(1, Math.round(imgW * ratio));
              targetH = Math.max(1, Math.round(imgH * ratio));
            }
          }

          // Prepare canvas
          const canvas = createCanvas(targetW, targetH);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(loadedImg, 0, 0, targetW, targetH);

          // Choose encoding strategy based on classification and profile
          let compressedBytes: Buffer;
          let newFilter = 'DCTDecode';

          if (classification.isPhotographic || isDirectJpeg) {
            // Photographic: JPEG encoding at profile-calibrated quality
            compressedBytes = await canvas.encode('jpeg', settings.jpegQuality);
            newFilter = 'DCTDecode';
          } else {
            // Diagrams / Line Art / Text screenshots: Flate/PNG encoding to prevent text ringing
            const pngBytes = await canvas.encode('png');
            compressedBytes = zlib.deflateSync(pngBytes, { level: 9 });
            newFilter = 'FlateDecode';
          }

          // Replace only if candidate stream is genuinely smaller than the original stream
          if (compressedBytes.length < rawContents.length) {
            dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
            dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
            dict.set(PDFName.of('Length'), PDFNumber.of(compressedBytes.length));
            dict.set(PDFName.of('Filter'), PDFName.of(newFilter));
            dict.delete(PDFName.of('DecodeParms'));

            // Handle transparency soft mask (/SMask) scaling if present
            const smaskRef = dict.get(PDFName.of('SMask'));
            if (smaskRef instanceof PDFRef && (targetW !== imgW || targetH !== imgH)) {
              await this.scaleSMask(doc, smaskRef, targetW, targetH);
            }

            const newStream = PDFRawStream.of(dict, compressedBytes);
            doc.context.assign(ref, newStream);
            optimizedImages++;
          }
        } catch {
          // Safeguard: individual stream decoding failure must never crash document pipeline
        }
      }
    } catch {
      // Safeguard: continue if enumeration encountered anomalies
    }

    return { total: totalImages, optimized: optimizedImages };
  }

  /**
   * Proportionally scale an attached soft mask (/SMask) stream to maintain pixel alignment
   */
  private async scaleSMask(
    doc: PDFDocument,
    smaskRef: PDFRef,
    targetW: number,
    targetH: number,
  ): Promise<void> {
    try {
      const smaskObj = doc.context.lookup(smaskRef);
      if (!smaskObj || !(smaskObj as any).dict) return;

      const smaskDict = (smaskObj as any).dict;
      const rawContents = Buffer.from((smaskObj as any).getContents());
      const filter = smaskDict.get(PDFName.of('Filter'))?.toString();

      let decompressed: Buffer | null = null;
      if (filter === '/FlateDecode') {
        try {
          decompressed = zlib.inflateSync(rawContents);
        } catch {
          decompressed = null;
        }
      } else {
        decompressed = rawContents;
      }

      if (!decompressed) return;

      let smaskImg: Image | null = null;
      try {
        smaskImg = await loadImage(decompressed);
      } catch {
        smaskImg = null;
      }

      if (smaskImg) {
        const canvas = createCanvas(targetW, targetH);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(smaskImg, 0, 0, targetW, targetH);

        const pngBytes = await canvas.encode('png');
        const deflated = zlib.deflateSync(pngBytes, { level: 9 });

        smaskDict.set(PDFName.of('Width'), PDFNumber.of(targetW));
        smaskDict.set(PDFName.of('Height'), PDFNumber.of(targetH));
        smaskDict.set(PDFName.of('Length'), PDFNumber.of(deflated.length));
        smaskDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
        smaskDict.delete(PDFName.of('DecodeParms'));

        doc.context.assign(smaskRef, PDFRawStream.of(smaskDict, deflated));
      }
    } catch {
      // Non-critical: preserve original SMask on scaling error
    }
  }

  /**
   * Classify whether an image is photographic vs. diagram/line-art/text screenshot
   */
  private classifyImage(img: Image): ImageClassification {
    try {
      const sampleCanvas = createCanvas(Math.min(img.width, 256), Math.min(img.height, 256));
      const ctx = sampleCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const imgData = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
      const data = imgData.data;

      let hasAlpha = false;
      const uniqueColors = new Set<number>();
      const sampleStep = Math.max(1, Math.floor(data.length / (4 * 500))); // Sample up to 500 pixels

      for (let i = 0; i < data.length; i += sampleStep * 4) {
        const a = data[i + 3];
        if (a < 250) {
          hasAlpha = true;
        }
        const rgbKey = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        uniqueColors.add(rgbKey);
      }

      // If sampled distinct colors > 100, treat as continuous-tone photographic
      const isPhotographic = uniqueColors.size > 100;
      return { isPhotographic, hasAlpha };
    } catch {
      return { isPhotographic: true, hasAlpha: false };
    }
  }
}

