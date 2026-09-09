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

interface ProfileCandidateSettings {
  maxDimension: number;
  jpegQuality: number;
  forceJpeg: boolean;
}

const TARGET_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB (1,048,576 bytes)

// Adaptive search ladder for EXTREME profile targeting <= 1 MB
const EXTREME_SEARCH_LADDER: ProfileCandidateSettings[] = [
  { maxDimension: 1600, jpegQuality: 65, forceJpeg: true },
  { maxDimension: 1440, jpegQuality: 58, forceJpeg: true },
  { maxDimension: 1280, jpegQuality: 52, forceJpeg: true },
  { maxDimension: 1120, jpegQuality: 46, forceJpeg: true },
  { maxDimension: 1024, jpegQuality: 40, forceJpeg: true },
  { maxDimension: 900, jpegQuality: 35, forceJpeg: true },
  { maxDimension: 800, jpegQuality: 32, forceJpeg: true },
];

// Search ladder for BALANCED profile
const BALANCED_SEARCH_LADDER: ProfileCandidateSettings[] = [
  { maxDimension: 1600, jpegQuality: 75, forceJpeg: false },
  { maxDimension: 1440, jpegQuality: 68, forceJpeg: false },
  { maxDimension: 1280, jpegQuality: 60, forceJpeg: false },
];

// Single pass for VISUALLY_LOSSLESS profile (high fidelity)
const LOSSLESS_SEARCH_LADDER: ProfileCandidateSettings[] = [
  { maxDimension: 2048, jpegQuality: 82, forceJpeg: false },
];

export class PdfCompressorAdapter implements UtilityAdapter<PdfCompressorInput, PdfCompressorOutput> {
  private readonly logger = new Logger(PdfCompressorAdapter.name);

  readonly slug = 'pdf-compressor';
  readonly name = 'PDF Compressor';
  readonly description = 'Adaptive multi-stage PDF optimizer targeting ≤1MB with real byte measurement';
  readonly version = '2.1.0';
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

    // Default to EXTREME (target <= 1MB) as requested by product requirement
    let validProfile: PdfCompressionProfile = 'EXTREME';
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

    const profile = input.profile || 'EXTREME';
    const ladder =
      profile === 'EXTREME'
        ? EXTREME_SEARCH_LADDER
        : profile === 'BALANCED'
          ? BALANCED_SEARCH_LADDER
          : LOSSLESS_SEARCH_LADDER;

    // Load initial source document to verify structure and page count
    let initialDoc: PDFDocument;
    try {
      initialDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }

    const pageCount = initialDoc.getPageCount();
    if (pageCount === 0) {
      throw new Error('PDF contains zero pages');
    }

    this.logger.log(
      `[PDF COMPRESSOR] INPUT: ${originalSize} bytes (${(originalSize / (1024 * 1024)).toFixed(2)} MB), Pages: ${pageCount}, Profile: ${profile}, Target: ${profile === 'EXTREME' ? '<= 1 MB' : 'calibrated reduction'}`,
    );

    let bestCandidate: Buffer | null = null;
    let bestCandidateSize = originalSize;
    let bestPass = 0;

    // Multi-pass candidate search
    for (let passIdx = 0; passIdx < ladder.length; passIdx++) {
      const candidateSettings = ladder[passIdx];
      const isFirstPass = passIdx === 0;

      // Load fresh document for this candidate pass
      let passDoc: PDFDocument;
      try {
        passDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      } catch (err: any) {
        this.logger.warn(`Pass ${passIdx + 1} load failed: ${err.message}`);
        continue;
      }

      // Stage 1: Structural catalog pruning
      this.cleanStructuralMetadata(passDoc);

      // Stage 2: Content-aware image stream optimization
      const imageStats = await this.optimizeImageStreams(
        passDoc,
        candidateSettings,
        isFirstPass,
      );

      // Stage 3: Fresh serialization with cross-reference object stream compaction
      let candidateBuffer: Buffer;
      try {
        const serialized = await passDoc.save({ useObjectStreams: true, addDefaultPage: false });
        candidateBuffer = Buffer.from(serialized);
      } catch (saveErr: any) {
        this.logger.warn(`Candidate pass ${passIdx + 1} serialization failed: ${saveErr.message}`);
        continue;
      }

      const candidateSize = candidateBuffer.length;
      this.logger.log(
        `Pass ${passIdx + 1}/${ladder.length} [maxDim=${candidateSettings.maxDimension}, Q=${candidateSettings.jpegQuality}]: Output=${candidateSize} bytes (${(candidateSize / (1024 * 1024)).toFixed(2)} MB), Images=${imageStats.total}, Optimized=${imageStats.optimized}`,
      );

      // Verify candidate reloads cleanly and preserves page count
      try {
        const verifyDoc = await PDFDocument.load(candidateBuffer, { ignoreEncryption: true });
        if (verifyDoc.getPageCount() === pageCount) {
          if (candidateSize < bestCandidateSize) {
            bestCandidate = candidateBuffer;
            bestCandidateSize = candidateSize;
            bestPass = passIdx + 1;
          }

          // In EXTREME mode, if candidate achieved <= 1 MB target, stop search immediately
          if (profile === 'EXTREME' && candidateSize <= TARGET_SIZE_BYTES) {
            this.logger.log(
              `Target <= 1MB achieved at pass ${passIdx + 1}: ${candidateSize} bytes (${(candidateSize / 1024).toFixed(1)} KB)`,
            );
            break;
          }
        }
      } catch (verifyErr: any) {
        this.logger.warn(`Pass ${passIdx + 1} candidate verification failed: ${verifyErr.message}`);
      }
    }

    // Safety fallback: Never return an output that is not smaller than original
    const finalBuffer = bestCandidate && bestCandidateSize < originalSize ? bestCandidate : buffer;
    const finalSize = finalBuffer.length;
    const wasActuallyCompressed = finalSize < originalSize;

    const savedBytes = Math.max(0, originalSize - finalSize);
    const savingsPercent =
      originalSize > 0 && wasActuallyCompressed
        ? Math.round((savedBytes / originalSize) * 1000) / 10
        : 0;
    const compressionRatio =
      finalSize > 0 ? Math.round((originalSize / finalSize) * 100) / 100 : 1.0;

    this.logger.log(
      `[PDF COMPRESSOR] RESULT: Profile=${profile} Input=${originalSize} bytes -> Output=${finalSize} bytes (${(finalSize / (1024 * 1024)).toFixed(2)} MB), Saved=${savedBytes} bytes (${savingsPercent}%), BestPass=${bestPass}/${ladder.length}`,
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
      // Non-critical
    }
  }

  /**
   * Traverse indirect objects, detect image XObjects, classify, and optimize
   */
  private async optimizeImageStreams(
    doc: PDFDocument,
    settings: ProfileCandidateSettings,
    isDiagnosticPass: boolean,
  ): Promise<{ total: number; optimized: number }> {
    let totalImages = 0;
    let optimizedImages = 0;

    try {
      const objects = doc.context.enumerateIndirectObjects();
      for (const [ref, obj] of objects) {
        if (!obj || !(obj as any).dict) continue;

        const dict = (obj as any).dict;
        const subtypeObj = doc.context.lookup(dict.get(PDFName.of('Subtype')));
        const subtype = subtypeObj ? subtypeObj.toString() : '';
        if (subtype !== '/Image') continue;

        totalImages++;

        try {
          const filterObj = doc.context.lookup(dict.get(PDFName.of('Filter')));
          const filterStr = filterObj ? filterObj.toString() : '';
          const rawContents = Buffer.from((obj as any).getContents());

          let decompressedBuffer: Buffer | null = null;
          let isDirectJpeg = false;

          // Check format signatures
          if (rawContents.length >= 2 && rawContents[0] === 0xff && rawContents[1] === 0xd8) {
            decompressedBuffer = rawContents;
            isDirectJpeg = true;
          } else if (rawContents.length >= 8 && rawContents[0] === 0x89 && rawContents[1] === 0x50) {
            decompressedBuffer = rawContents;
          } else if (filterStr.includes('FlateDecode') || !filterObj) {
            try {
              decompressedBuffer = filterStr.includes('FlateDecode')
                ? zlib.inflateSync(rawContents)
                : rawContents;
            } catch {
              try {
                decompressedBuffer = zlib.unzipSync(rawContents);
              } catch {
                decompressedBuffer = null;
              }
            }
          }

          if (!decompressedBuffer || decompressedBuffer.length === 0) continue;

          let loadedImg: Image | null = null;

          // Decode if container format (JPEG SOI or PNG magic)
          if (
            (decompressedBuffer.length >= 2 && decompressedBuffer[0] === 0xff && decompressedBuffer[1] === 0xd8) ||
            (decompressedBuffer.length >= 8 && decompressedBuffer[0] === 0x89 && decompressedBuffer[1] === 0x50)
          ) {
            try {
              loadedImg = await loadImage(decompressedBuffer);
            } catch {
              loadedImg = null;
            }
          }

          // If raw bitmap without container header, decode via dimensions and ColorSpace
          if (!loadedImg) {
            const wObj = doc.context.lookup(dict.get(PDFName.of('Width')));
            const hObj = doc.context.lookup(dict.get(PDFName.of('Height')));
            const w = (wObj as any)?.asNumber ? (wObj as any).asNumber() : Number(wObj?.toString());
            const h = (hObj as any)?.asNumber ? (hObj as any).asNumber() : Number(hObj?.toString());

            if (w > 0 && h > 0 && w * h <= 40_000_000) {
              const csObj = doc.context.lookup(dict.get(PDFName.of('ColorSpace')));
              const csStr = csObj ? csObj.toString() : '';

              if (csStr.includes('DeviceRGB') && decompressedBuffer.length >= w * h * 3) {
                const rawCanvas = createCanvas(w, h);
                const rawCtx = rawCanvas.getContext('2d');
                const imgData = rawCtx.createImageData(w, h);
                let src = 0;
                let dst = 0;
                for (let p = 0; p < w * h; p++) {
                  imgData.data[dst] = decompressedBuffer[src];
                  imgData.data[dst + 1] = decompressedBuffer[src + 1];
                  imgData.data[dst + 2] = decompressedBuffer[src + 2];
                  imgData.data[dst + 3] = 255;
                  src += 3;
                  dst += 4;
                }
                rawCtx.putImageData(imgData, 0, 0);
                const pngTmp = await rawCanvas.encode('png');
                loadedImg = await loadImage(pngTmp);
              } else if (csStr.includes('DeviceGray') && decompressedBuffer.length >= w * h) {
                const rawCanvas = createCanvas(w, h);
                const rawCtx = rawCanvas.getContext('2d');
                const imgData = rawCtx.createImageData(w, h);
                let src = 0;
                let dst = 0;
                for (let p = 0; p < w * h; p++) {
                  const g = decompressedBuffer[src];
                  imgData.data[dst] = g;
                  imgData.data[dst + 1] = g;
                  imgData.data[dst + 2] = g;
                  imgData.data[dst + 3] = 255;
                  src += 1;
                  dst += 4;
                }
                rawCtx.putImageData(imgData, 0, 0);
                const pngTmp = await rawCanvas.encode('png');
                loadedImg = await loadImage(pngTmp);
              }
            }
          }

          if (!loadedImg) continue;

          const imgW = loadedImg.width;
          const imgH = loadedImg.height;
          if (imgW <= 0 || imgH <= 0) continue;

          const classification = this.classifyImage(loadedImg);

          let targetW = imgW;
          let targetH = imgH;
          const maxDim = settings.maxDimension;

          if (imgW > maxDim || imgH > maxDim) {
            const ratio = Math.min(maxDim / imgW, maxDim / imgH);
            targetW = Math.max(1, Math.round(imgW * ratio));
            targetH = Math.max(1, Math.round(imgH * ratio));
          }

          const canvas = createCanvas(targetW, targetH);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(loadedImg, 0, 0, targetW, targetH);

          let compressedBytes: Buffer;
          let newFilter = 'DCTDecode';

          // Force JPEG in Extreme mode or when continuous-tone photographic
          if (settings.forceJpeg || classification.isPhotographic || isDirectJpeg) {
            compressedBytes = await canvas.encode('jpeg', settings.jpegQuality);
            newFilter = 'DCTDecode';
          } else {
            const pngBytes = await canvas.encode('png');
            compressedBytes = zlib.deflateSync(pngBytes, { level: 9 });
            newFilter = 'FlateDecode';
          }

          if (isDiagnosticPass) {
            this.logger.log(
              `[Image #${totalImages}] Original=${rawContents.length} B (${(rawContents.length / 1024).toFixed(1)} KB), Format=${filterStr || 'raw'}, Decoded=${imgW}x${imgH} -> Target=${targetW}x${targetH}, Compressed=${compressedBytes.length} B (${(compressedBytes.length / 1024).toFixed(1)} KB)`,
            );
          }

          // Replace stream if candidate is smaller than original stream
          if (compressedBytes.length < rawContents.length) {
            dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
            dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
            dict.set(PDFName.of('Length'), PDFNumber.of(compressedBytes.length));
            dict.set(PDFName.of('Filter'), PDFName.of(newFilter));
            dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
            dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
            dict.delete(PDFName.of('DecodeParms'));

            // Soft mask (/SMask) scaling for transparency preservation
            const smaskRef = dict.get(PDFName.of('SMask'));
            if (smaskRef instanceof PDFRef && (targetW !== imgW || targetH !== imgH)) {
              await this.scaleSMask(doc, smaskRef, targetW, targetH);
            }

            const newStream = PDFRawStream.of(dict, compressedBytes);
            doc.context.assign(ref, newStream);
            optimizedImages++;
          }
        } catch {
          // Non-critical: skip individual stream on decode anomaly
        }
      }
    } catch {
      // Non-critical: continue if traversal encounters anomalies
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
      const filterObj = doc.context.lookup(smaskDict.get(PDFName.of('Filter')));
      const filterStr = filterObj ? filterObj.toString() : '';

      let decompressed: Buffer | null = null;
      if (filterStr.includes('FlateDecode')) {
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
      const sampleStep = Math.max(1, Math.floor(data.length / (4 * 500)));

      for (let i = 0; i < data.length; i += sampleStep * 4) {
        const a = data[i + 3];
        if (a < 250) {
          hasAlpha = true;
        }
        const rgbKey = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        uniqueColors.add(rgbKey);
      }

      const isPhotographic = uniqueColors.size > 100;
      return { isPhotographic, hasAlpha };
    } catch {
      return { isPhotographic: true, hasAlpha: false };
    }
  }
}
