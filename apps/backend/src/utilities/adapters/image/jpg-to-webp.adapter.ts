import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  JpgToWebpInput,
  JpgToWebpOutput,
} from '@ad-utility/shared';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validateJpegMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class JpgToWebpAdapter implements UtilityAdapter<JpgToWebpInput, JpgToWebpOutput> {
  readonly slug = 'jpg-to-webp';
  readonly name = 'JPG to WebP';
  readonly description = 'Convert JPG images to modern, high-efficiency WebP format';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
    maxExecutionTimeMs: 10000,
    allowedMimeTypes: ['image/jpeg', 'image/jpg'],
  };

  validateInput(input: unknown): JpgToWebpInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, quality, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    return {
      fileData,
      quality: typeof quality === 'number' && quality >= 1 && quality <= 100 ? quality : 80,
      filename: sanitizeFilename(filename, 'converted', 'webp'),
    };
  }

  async execute(input: JpgToWebpInput, _context: UtilityExecutionContext): Promise<JpgToWebpOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 20971520;
    if (buffer.length > maxBytes) {
      throw new Error(`File size exceeds the 20MB limit`);
    }

    validateJpegMagicBytes(buffer);

    let img: any;
    try {
      img = await loadImage(buffer);
    } catch (err: any) {
      throw new Error(`Failed to decode JPEG image: ${err.message}`);
    }

    const { width, height } = img;
    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error('Invalid image dimensions');
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const q = (input.quality || 80) / 100;
    const webpBuffer = canvas.toBuffer('image/webp', { quality: q });
    const dataUrl = bufferToDataUrl(webpBuffer, 'image/webp');

    const outFilename = input.filename?.endsWith('.webp') ? input.filename : `${input.filename || 'converted'}.webp`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: webpBuffer.length,
      width,
      height,
    };
  }
}
