import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PngToJpgInput,
  PngToJpgOutput,
} from '@ad-utility/shared';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePngMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PngToJpgAdapter implements UtilityAdapter<PngToJpgInput, PngToJpgOutput> {
  readonly slug = 'png-to-jpg';
  readonly name = 'PNG to JPG Converter';
  readonly description = 'Convert PNG images to standard JPEG with deterministic alpha flattening';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['image/png'],
  };

  validateInput(input: unknown): PngToJpgInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, quality, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required (base64 or data URL)');
    }

    let parsedQuality = 85;
    if (typeof quality === 'number') {
      parsedQuality = Math.max(1, Math.min(100, Math.round(quality)));
    }

    return {
      fileData,
      quality: parsedQuality,
      filename: sanitizeFilename(filename, 'converted', 'jpg'),
    };
  }

  async execute(input: PngToJpgInput, _context: UtilityExecutionContext): Promise<PngToJpgOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`File size exceeds the 200MB limit`);
    }

    // Authoritative magic bytes verification
    validatePngMagicBytes(buffer);

    // Decode PNG to RGBA
    let png: PNG;
    try {
      png = PNG.sync.read(buffer);
    } catch (err: any) {
      throw new Error(`Failed to decode PNG image: ${err.message}`);
    }

    const { width, height, data } = png;
    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error('Decoded image has invalid dimensions');
    }

    // Deterministic alpha compositing: flatten transparent pixels onto solid white background (255, 255, 255)
    const totalPixels = width * height;
    const rgbaBuffer = Buffer.alloc(totalPixels * 4);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3] / 255; // 0.0 to 1.0

      if (a === 1) {
        rgbaBuffer[idx] = r;
        rgbaBuffer[idx + 1] = g;
        rgbaBuffer[idx + 2] = b;
      } else if (a === 0) {
        // Pure transparent -> solid white
        rgbaBuffer[idx] = 255;
        rgbaBuffer[idx + 1] = 255;
        rgbaBuffer[idx + 2] = 255;
      } else {
        // Standard alpha blend over white
        rgbaBuffer[idx] = Math.round(r * a + 255 * (1 - a));
        rgbaBuffer[idx + 1] = Math.round(g * a + 255 * (1 - a));
        rgbaBuffer[idx + 2] = Math.round(b * a + 255 * (1 - a));
      }
      rgbaBuffer[idx + 3] = 255; // JPEG opaque alpha
    }

    // Encode to JPEG
    const quality = input.quality || 85;
    const jpegImageData = jpeg.encode(
      {
        data: rgbaBuffer,
        width,
        height,
      },
      quality,
    );

    const jpegBuffer = Buffer.from(jpegImageData.data);
    const dataUrl = bufferToDataUrl(jpegBuffer, 'image/jpeg');

    const outFilename = input.filename?.endsWith('.jpg') || input.filename?.endsWith('.jpeg')
      ? input.filename
      : `${input.filename?.replace(/\.[^/.]+$/, '') || 'converted'}.jpg`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: jpegBuffer.length,
      width,
      height,
      background: 'Alpha channel blended over solid white (#FFFFFF)',
    };
  }
}
