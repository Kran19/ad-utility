import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  ImageCompressorInput,
  ImageCompressorOutput,
} from '@ad-utility/shared';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  parseBase64Payload,
  bufferToDataUrl,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class ImageCompressorAdapter implements UtilityAdapter<ImageCompressorInput, ImageCompressorOutput> {
  readonly slug = 'image-compressor';
  readonly name = 'Image Compressor';
  readonly description = 'Compress JPEG and PNG images while preserving visual quality';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 15 * 1024 * 1024, // 15MB
    maxExecutionTimeMs: 10000,
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  };

  validateInput(input: unknown): ImageCompressorInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, quality, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required (base64 or data URL)');
    }

    let parsedQuality = 70;
    if (typeof quality === 'number') {
      parsedQuality = Math.max(1, Math.min(100, Math.round(quality)));
    }

    return {
      fileData,
      quality: parsedQuality,
      filename: sanitizeFilename(filename, 'compressed', 'jpg'),
    };
  }

  async execute(input: ImageCompressorInput, _context: UtilityExecutionContext): Promise<ImageCompressorOutput> {
    const { buffer, mimeType } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 15728640;
    if (buffer.length > maxBytes) {
      throw new Error(`File size (${Math.round(buffer.length / 1024)}KB) exceeds the 15MB limit`);
    }

    const isJpeg =
      (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
      mimeType === 'image/jpeg';
    const isPng =
      (buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47) ||
      mimeType === 'image/png';

    if (!isJpeg && !isPng) {
      throw new Error('Unsupported image format. Only JPEG and PNG images are supported for compression.');
    }

    const quality = input.quality || 70;
    let outputBuffer: Buffer;
    let outputFormat: 'image/jpeg' | 'image/png';

    if (isJpeg) {
      outputFormat = 'image/jpeg';
      const decoded = jpeg.decode(buffer, { useTArray: true });
      const encoded = jpeg.encode(
        {
          data: Buffer.from(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
          width: decoded.width,
          height: decoded.height,
        },
        quality,
      );
      outputBuffer = Buffer.from(encoded.data);
    } else {
      // PNG compression
      outputFormat = 'image/png';
      const png = PNG.sync.read(buffer);
      // Re-encode with maximum deflate compression
      outputBuffer = PNG.sync.write(png, {
        deflateLevel: 9,
        filterType: 4, // Paeth filter
      });
    }

    const originalSize = buffer.length;
    const compressedSize = outputBuffer.length;
    const savingsBytes = Math.max(0, originalSize - compressedSize);
    const savingsPercent = originalSize > 0 ? Math.round((savingsBytes / originalSize) * 1000) / 10 : 0;

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
    const outFilename = input.filename?.includes('.')
      ? input.filename
      : `compressed-${Date.now()}.${ext}`;

    return {
      dataUrl: bufferToDataUrl(outputBuffer, outputFormat),
      filename: outFilename,
      originalSizeBytes: originalSize,
      compressedSizeBytes: compressedSize,
      savingsPercent,
      format: outputFormat,
    };
  }
}
