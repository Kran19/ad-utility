import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  ImageCompressorInput,
  ImageCompressorOutput,
} from '@ad-utility/shared';
import { createCanvas, loadImage } from '@napi-rs/canvas';
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

    try {
      // Check if PNG has transparent alpha pixels
      let hasAlpha = false;
      if (isPng) {
        const png = PNG.sync.read(buffer);
        for (let i = 3; i < png.data.length; i += 4) {
          if (png.data[i] < 250) {
            hasAlpha = true;
            break;
          }
        }
      }

      const img = await loadImage(buffer);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // If JPEG or PNG without alpha transparency, compress via high-performance JPEG encoding directly responding to quality
      if (isJpeg || !hasAlpha) {
        outputFormat = 'image/jpeg';
        outputBuffer = await canvas.encode('jpeg', quality);
      } else {
        // Transparent PNG: optimize PNG compression based on quality level
        outputFormat = 'image/png';
        const pngBuf = await canvas.encode('png');

        // If quality is lower, quantize color steps for higher deflate ratio
        if (quality < 90) {
          const png = PNG.sync.read(pngBuf);
          const step = Math.max(2, Math.round((100 - quality) * 0.35));
          for (let i = 0; i < png.data.length; i += 4) {
            png.data[i] = Math.min(255, Math.round(png.data[i] / step) * step);
            png.data[i + 1] = Math.min(255, Math.round(png.data[i + 1] / step) * step);
            png.data[i + 2] = Math.min(255, Math.round(png.data[i + 2] / step) * step);
          }
          const quantizedBuf = PNG.sync.write(png, { deflateLevel: 9, filterType: 4 });
          outputBuffer = quantizedBuf.length < pngBuf.length ? quantizedBuf : pngBuf;
        } else {
          outputBuffer = pngBuf;
        }
      }
    } catch {
      // Pure JS fallback if native canvas fails
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
        outputFormat = 'image/png';
        const png = PNG.sync.read(buffer);
        const step = quality < 90 ? Math.max(2, Math.round((100 - quality) * 0.35)) : 1;
        if (step > 1) {
          for (let i = 0; i < png.data.length; i += 4) {
            png.data[i] = Math.min(255, Math.round(png.data[i] / step) * step);
            png.data[i + 1] = Math.min(255, Math.round(png.data[i + 1] / step) * step);
            png.data[i + 2] = Math.min(255, Math.round(png.data[i + 2] / step) * step);
          }
        }
        outputBuffer = PNG.sync.write(png, { deflateLevel: 9, filterType: 4 });
      }
    }

    const originalSize = buffer.length;
    const compressedSize = outputBuffer.length;
    const savingsBytes = Math.max(0, originalSize - compressedSize);
    const savingsPercent = originalSize > 0 ? Math.round((savingsBytes / originalSize) * 1000) / 10 : 0;

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
    const outFilename = input.filename?.includes('.')
      ? input.filename.replace(/\.[^.]+$/, `.${ext}`)
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
