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
import * as crypto from 'crypto';
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

interface ObjectForensic {
  ref: string;
  type: string;
  bytes: number;
  filter: string;
  width?: number;
  height?: number;
  colorSpace?: string;
  extra?: string;
}

interface PdfForensicReport {
  inputBytes: number;
  pageCount: number;
  totalImages: number;
  imageBytes: number;
  formBytes: number;
  fontBytes: number;
  iccBytes: number;
  metadataBytes: number;
  contentBytes: number;
  otherBytes: number;
  dominantContributor: string;
  largestObjects: ObjectForensic[];
}

const TARGET_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB (1,048,576 bytes)

// Adaptive search ladder for EXTREME profile targeting <= 1 MB
const EXTREME_SEARCH_LADDER: ProfileCandidateSettings[] = [
  { maxDimension: 1440, jpegQuality: 65, forceJpeg: true },
  { maxDimension: 1280, jpegQuality: 55, forceJpeg: true },
  { maxDimension: 1120, jpegQuality: 48, forceJpeg: true },
  { maxDimension: 1024, jpegQuality: 42, forceJpeg: true },
  { maxDimension: 900, jpegQuality: 38, forceJpeg: true },
  { maxDimension: 800, jpegQuality: 34, forceJpeg: true },
];

// Search ladder for BALANCED profile (preserves balanced fidelity and readability)
const BALANCED_SEARCH_LADDER: ProfileCandidateSettings[] = [
  { maxDimension: 1600, jpegQuality: 76, forceJpeg: false },
  { maxDimension: 1440, jpegQuality: 70, forceJpeg: false },
];

// Single pass for VISUALLY_LOSSLESS profile (high fidelity)
const LOSSLESS_SEARCH_LADDER: ProfileCandidateSettings[] = [
  { maxDimension: 2048, jpegQuality: 85, forceJpeg: false },
];

export class PdfCompressorAdapter implements UtilityAdapter<PdfCompressorInput, PdfCompressorOutput> {
  private readonly logger = new Logger(PdfCompressorAdapter.name);

  readonly slug = 'pdf-compressor';
  readonly name = 'PDF Compressor';
  readonly description = 'Adaptive multi-stage PDF optimizer targeting ≤1MB with real byte measurement';
  readonly version = '2.2.0';
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
    const startTime = Date.now();
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

    // Load initial source document to verify structure and perform deep forensic analysis
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

    // Run Forensic Analysis BEFORE optimization
    const forensicsBefore = this.analyzePdfForensics(initialDoc, originalSize, pageCount);
    this.logForensicsReport('BEFORE OPTIMIZATION', forensicsBefore);

    let bestCandidate: Buffer | null = null;
    let bestCandidateSize = originalSize;
    let bestPass = 0;
    let bestStats = { total: forensicsBefore.totalImages, optimized: 0, deduplicated: 0, nested: 0 };

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

      // Stage 2: Recursive Form XObject & Image stream optimization with deduplication
      const passStats = await this.optimizeAllImageStreams(
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
        `Pass ${passIdx + 1}/${ladder.length} [maxDim=${candidateSettings.maxDimension}, Q=${candidateSettings.jpegQuality}]: Output=${candidateSize} bytes (${(candidateSize / (1024 * 1024)).toFixed(2)} MB), Images=${passStats.total}, Optimized=${passStats.optimized}, Deduplicated=${passStats.deduplicated}`,
      );

      // Verify candidate reloads cleanly and preserves page count
      try {
        const verifyDoc = await PDFDocument.load(candidateBuffer, { ignoreEncryption: true });
        if (verifyDoc.getPageCount() === pageCount) {
          if (candidateSize < bestCandidateSize) {
            bestCandidate = candidateBuffer;
            bestCandidateSize = candidateSize;
            bestPass = passIdx + 1;
            bestStats = passStats;
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

    // Run Forensic Analysis AFTER optimization
    if (wasActuallyCompressed) {
      try {
        const afterDoc = await PDFDocument.load(finalBuffer, { ignoreEncryption: true });
        const forensicsAfter = this.analyzePdfForensics(afterDoc, finalSize, pageCount);
        this.logForensicsReport('AFTER OPTIMIZATION', forensicsAfter);
      } catch {
        // Non-critical diagnostic
      }
    }

    const executionTimeMs = Date.now() - startTime;
    this.logger.log(
      `utility=pdf-compressor inputBytes=${originalSize} outputBytes=${finalSize} savedBytes=${savedBytes} savingsPercent=${savingsPercent}% profile=${profile} pageCount=${pageCount} imageCount=${bestStats.total} optimizedImageCount=${bestStats.optimized} nestedImageCount=${bestStats.nested} duplicateImageCount=${bestStats.deduplicated} executionTimeMs=${executionTimeMs}`,
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
   * PDF Forensic Analyzer: Catalogs every object and measures byte distribution
   */
  private analyzePdfForensics(doc: PDFDocument, totalBytes: number, pageCount: number): PdfForensicReport {
    const objects = doc.context.enumerateIndirectObjects();
    const objectList: ObjectForensic[] = [];

    let imageBytes = 0;
    let formBytes = 0;
    let fontBytes = 0;
    let iccBytes = 0;
    let metadataBytes = 0;
    let contentBytes = 0;
    let otherBytes = 0;
    let totalImages = 0;

    for (const [ref, obj] of objects) {
      if (!obj) continue;
      const isStream = typeof (obj as any).getContents === 'function';
      let bytes = 0;
      if (isStream) {
        try {
          bytes = (obj as any).getContents().length;
        } catch {
          bytes = 0;
        }
      }

      let typeStr = 'Non-stream Object';
      let filterStr = '';
      let w: number | undefined;
      let h: number | undefined;
      let colorSpace: string | undefined;
      let extra = '';

      if ((obj as any).dict) {
        const dict = (obj as any).dict;
        const typeObj = doc.context.lookup(dict.get(PDFName.of('Type')));
        const subtypeObj = doc.context.lookup(dict.get(PDFName.of('Subtype')));
        const filterObj = doc.context.lookup(dict.get(PDFName.of('Filter')));
        filterStr = filterObj ? filterObj.toString() : '';

        const typeVal = typeObj ? typeObj.toString() : '';
        const subtypeVal = subtypeObj ? subtypeObj.toString() : '';

        if (subtypeVal === '/Image') {
          typeStr = 'Image XObject';
          totalImages++;
          imageBytes += bytes;
          const wObj = doc.context.lookup(dict.get(PDFName.of('Width')));
          const hObj = doc.context.lookup(dict.get(PDFName.of('Height')));
          w = typeof (wObj as any)?.asNumber === 'function' ? (wObj as any).asNumber() : Number(wObj?.toString());
          h = typeof (hObj as any)?.asNumber === 'function' ? (hObj as any).asNumber() : Number(hObj?.toString());
          const csObj = doc.context.lookup(dict.get(PDFName.of('ColorSpace')));
          colorSpace = csObj ? csObj.toString() : '';
          const smask = doc.context.lookup(dict.get(PDFName.of('SMask')));
          extra = `Width=${w}, Height=${h}, CS=${colorSpace?.slice(0, 30)}, SMask=${!!smask}`;
        } else if (subtypeVal === '/Form') {
          typeStr = 'Form XObject';
          formBytes += bytes;
          const res = doc.context.lookup(dict.get(PDFName.of('Resources')));
          extra = `HasResources=${!!res}`;
        } else if (typeVal === '/Font' || subtypeVal?.includes('Font') || typeVal === '/FontDescriptor') {
          typeStr = 'Font / FontDescriptor';
          fontBytes += bytes;
        } else if (dict.has(PDFName.of('N')) && filterStr.includes('FlateDecode') && bytes > 200) {
          typeStr = 'ICC Profile';
          iccBytes += bytes;
        } else if (typeVal === '/Metadata' || subtypeVal === '/XML') {
          typeStr = 'Metadata';
          metadataBytes += bytes;
        } else if (isStream) {
          typeStr = 'Content Stream';
          contentBytes += bytes;
        }
      } else if (isStream) {
        typeStr = 'Other Stream';
        otherBytes += bytes;
      }

      if (bytes > 512) {
        objectList.push({
          ref: ref.toString(),
          type: typeStr,
          bytes,
          filter: filterStr,
          width: w,
          height: h,
          colorSpace,
          extra,
        });
      }
    }

    objectList.sort((a, b) => b.bytes - a.bytes);

    let dominantContributor = 'Images';
    const maxVal = Math.max(imageBytes, formBytes, fontBytes, iccBytes, metadataBytes, contentBytes, otherBytes);
    if (maxVal === formBytes) dominantContributor = 'Form XObjects';
    else if (maxVal === fontBytes) dominantContributor = 'Fonts';
    else if (maxVal === iccBytes) dominantContributor = 'ICC Profiles';
    else if (maxVal === contentBytes) dominantContributor = 'Content Streams';
    else if (maxVal === otherBytes) dominantContributor = 'Other Streams';

    return {
      inputBytes: totalBytes,
      pageCount,
      totalImages,
      imageBytes,
      formBytes,
      fontBytes,
      iccBytes,
      metadataBytes,
      contentBytes,
      otherBytes,
      dominantContributor,
      largestObjects: objectList,
    };
  }

  /**
   * Log forensic analysis report
   */
  private logForensicsReport(title: string, report: PdfForensicReport): void {
    this.logger.log(`\n========================================\nPDF SIZE FORENSICS: ${title}\n========================================`);
    this.logger.log(`Input: ${(report.inputBytes / (1024 * 1024)).toFixed(2)} MB (${report.inputBytes} bytes), Pages: ${report.pageCount}`);
    this.logger.log(`Dominant size contributor: ${report.dominantContributor}`);
    this.logger.log(`Total image bytes: ${(report.imageBytes / (1024 * 1024)).toFixed(2)} MB (${report.imageBytes} bytes) across ${report.totalImages} images`);
    this.logger.log(`Total Form XObject bytes: ${(report.formBytes / 1024).toFixed(1)} KB`);
    this.logger.log(`Total font bytes: ${(report.fontBytes / 1024).toFixed(1)} KB`);
    this.logger.log(`Total ICC profile bytes: ${(report.iccBytes / 1024).toFixed(1)} KB`);
    this.logger.log(`Total metadata bytes: ${(report.metadataBytes / 1024).toFixed(1)} KB`);
    this.logger.log(`Total content stream bytes: ${(report.contentBytes / 1024).toFixed(1)} KB`);

    this.logger.log('\nLargest Objects:');
    report.largestObjects.slice(0, 10).forEach((item, idx) => {
      this.logger.log(
        `#${idx + 1} Ref: ${item.ref} | Type: ${item.type} | Bytes: ${(item.bytes / 1024).toFixed(1)} KB | Filter: ${item.filter || 'raw'} | ${item.extra || ''}`,
      );
    });
    this.logger.log('========================================\n');
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
   * Recursive Form XObject and page resource traversal with deduplication
   */
  private async optimizeAllImageStreams(
    doc: PDFDocument,
    settings: ProfileCandidateSettings,
    isDiagnosticPass: boolean,
  ): Promise<{ total: number; optimized: number; deduplicated: number; nested: number }> {
    let totalImages = 0;
    let optimizedImages = 0;
    let deduplicatedImages = 0;
    let nestedImages = 0;

    // Collect all image references (both direct indirect objects and nested in Form XObjects)
    const discoveredImageRefs = new Map<string, { ref: PDFRef; obj: any; parentForm?: PDFRef }>();
    const visitedFormRefs = new Set<string>();

    // 1. Recursive helper for Form XObjects
    const traverseResources = (resourcesDict: any, parentFormRef?: PDFRef) => {
      if (!resourcesDict || typeof resourcesDict.get !== 'function') return;
      const xobjectDict = doc.context.lookup(resourcesDict.get(PDFName.of('XObject')));
      if (!xobjectDict || typeof (xobjectDict as any).entries !== 'function') return;

      for (const [key, val] of (xobjectDict as any).entries()) {
        const resolved = doc.context.lookup(val);
        if (!resolved || !(resolved as any).dict) continue;
        const dict = (resolved as any).dict;
        const subtypeObj = doc.context.lookup(dict.get(PDFName.of('Subtype')));
        const subtype = subtypeObj ? subtypeObj.toString() : '';

        if (subtype === '/Form' && val instanceof PDFRef) {
          const formRefStr = val.toString();
          if (!visitedFormRefs.has(formRefStr)) {
            visitedFormRefs.add(formRefStr);
            const nestedRes = doc.context.lookup(dict.get(PDFName.of('Resources')));
            if (nestedRes) {
              traverseResources(nestedRes, val);
            }
          }
        } else if (subtype === '/Image' && val instanceof PDFRef) {
          const imgRefStr = val.toString();
          if (!discoveredImageRefs.has(imgRefStr)) {
            discoveredImageRefs.set(imgRefStr, { ref: val, obj: resolved, parentForm: parentFormRef });
            if (parentFormRef) nestedImages++;
          }
        }
      }
    };

    // 2. Scan all pages' /Resources
    const pageCount = doc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.getPage(i);
      const res = page.node.Resources();
      if (res) {
        traverseResources(res);
      }
    }

    // 3. Scan all indirect objects in doc.context to ensure no orphaned or appearance images are missed
    const allObjects = doc.context.enumerateIndirectObjects();
    for (const [ref, obj] of allObjects) {
      if (!obj || !(obj as any).dict) continue;
      const dict = (obj as any).dict;
      const subtypeObj = doc.context.lookup(dict.get(PDFName.of('Subtype')));
      const subtype = subtypeObj ? subtypeObj.toString() : '';

      if (subtype === '/Image') {
        const refStr = ref.toString();
        if (!discoveredImageRefs.has(refStr)) {
          discoveredImageRefs.set(refStr, { ref, obj });
        }
      } else if (subtype === '/Form') {
        const formRefStr = ref.toString();
        if (!visitedFormRefs.has(formRefStr)) {
          visitedFormRefs.add(formRefStr);
          const formRes = doc.context.lookup(dict.get(PDFName.of('Resources')));
          if (formRes) {
            traverseResources(formRes, ref);
          }
        }
      }
    }

    totalImages = discoveredImageRefs.size;

    // Content hash map for deduplicating identical image pixel streams
    const processedHashes = new Map<string, { ref: PDFRef; dict: any; stream: any }>();

    for (const [refStr, { ref, obj }] of discoveredImageRefs.entries()) {
      try {
        const dict = obj.dict;
        if (typeof obj.getContents !== 'function') continue;
        const rawContents = Buffer.from(obj.getContents());
        if (rawContents.length === 0) continue;

        // Check for duplicate identical streams
        const contentHash = crypto.createHash('sha256').update(rawContents).digest('hex');
        if (processedHashes.has(contentHash)) {
          const primary = processedHashes.get(contentHash)!;
          // Duplicate detected: share the optimized stream
          doc.context.assign(ref, primary.stream);
          deduplicatedImages++;
          continue;
        }

        const filterObj = doc.context.lookup(dict.get(PDFName.of('Filter')));
        const filterStr = filterObj ? filterObj.toString() : '';

        const wObj = doc.context.lookup(dict.get(PDFName.of('Width')));
        const hObj = doc.context.lookup(dict.get(PDFName.of('Height')));
        const w = typeof (wObj as any)?.asNumber === 'function' ? (wObj as any).asNumber() : Number(wObj?.toString());
        const h = typeof (hObj as any)?.asNumber === 'function' ? (hObj as any).asNumber() : Number(hObj?.toString());

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

        // Handle raw bitmaps without container header (ICCBased, DeviceRGB, DeviceGray, CMYK)
        if (!loadedImg && w > 0 && h > 0 && w * h <= 40_000_000) {
          const csObj = doc.context.lookup(dict.get(PDFName.of('ColorSpace')));
          const csStr = csObj ? csObj.toString() : '';

          // Validate color space and byte match
          if (
            (csStr.includes('RGB') || csStr.includes('ICCBased') || csStr.includes('CalRGB') || !csObj) &&
            decompressedBuffer.length === w * h * 3
          ) {
            // Raw 24-bit RGB bitmap (dominant format in Canva presentations!)
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
          } else if (
            (csStr.includes('Gray') || !csObj) &&
            decompressedBuffer.length === w * h
          ) {
            // Raw 8-bit Grayscale
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
          } else if (
            (csStr.includes('CMYK') || csStr.includes('DeviceCMYK')) &&
            decompressedBuffer.length === w * h * 4
          ) {
            // Raw 32-bit CMYK -> Convert to RGB
            const rawCanvas = createCanvas(w, h);
            const rawCtx = rawCanvas.getContext('2d');
            const imgData = rawCtx.createImageData(w, h);
            let src = 0;
            let dst = 0;
            for (let p = 0; p < w * h; p++) {
              const c = decompressedBuffer[src] / 255;
              const m = decompressedBuffer[src + 1] / 255;
              const y = decompressedBuffer[src + 2] / 255;
              const k = decompressedBuffer[src + 3] / 255;
              imgData.data[dst] = Math.round(255 * (1 - c) * (1 - k));
              imgData.data[dst + 1] = Math.round(255 * (1 - m) * (1 - k));
              imgData.data[dst + 2] = Math.round(255 * (1 - y) * (1 - k));
              imgData.data[dst + 3] = 255;
              src += 4;
              dst += 4;
            }
            rawCtx.putImageData(imgData, 0, 0);
            const pngTmp = await rawCanvas.encode('png');
            loadedImg = await loadImage(pngTmp);
          } else if (decompressedBuffer.length === w * h * 4) {
            // Raw 32-bit RGBA
            const rawCanvas = createCanvas(w, h);
            const rawCtx = rawCanvas.getContext('2d');
            const imgData = rawCtx.createImageData(w, h);
            imgData.data.set(decompressedBuffer.subarray(0, w * h * 4));
            rawCtx.putImageData(imgData, 0, 0);
            const pngTmp = await rawCanvas.encode('png');
            loadedImg = await loadImage(pngTmp);
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

        // Force JPEG in Extreme mode or when photographic
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
            `[Image Ref ${refStr}] Original=${rawContents.length} B (${(rawContents.length / 1024).toFixed(1)} KB), Format=${filterStr || 'raw'}, Decoded=${imgW}x${imgH} -> Target=${targetW}x${targetH}, Compressed=${compressedBytes.length} B (${(compressedBytes.length / 1024).toFixed(1)} KB), Saved=${(100 - (compressedBytes.length / rawContents.length) * 100).toFixed(1)}%`,
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
          dict.delete(PDFName.of('ColorTransform'));

          // Soft mask (/SMask) scaling for transparency preservation
          const smaskRef = dict.get(PDFName.of('SMask'));
          if (smaskRef instanceof PDFRef && (targetW !== imgW || targetH !== imgH)) {
            await this.scaleSMask(doc, smaskRef, targetW, targetH);
          }

          const newStream = PDFRawStream.of(dict, compressedBytes);
          doc.context.assign(ref, newStream);
          processedHashes.set(contentHash, { ref, dict, stream: newStream });
          optimizedImages++;
        }
      } catch (imgErr: any) {
        this.logger.warn(`Failed optimizing image ${refStr}: ${imgErr.message}`);
      }
    }

    return { total: totalImages, optimized: optimizedImages, deduplicated: deduplicatedImages, nested: nestedImages };
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
