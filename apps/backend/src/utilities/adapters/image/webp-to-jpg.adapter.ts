import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  WebpToJpgInput,
  WebpToJpgOutput,
} from '@ad-utility/shared';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validateWebpMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class WebpToJpgAdapter implements UtilityAdapter<WebpToJpgInput, WebpToJpgOutput> {
  readonly slug = 'webp-to-jpg';
  readonly name = 'WebP to JPG';
  readonly description = 'Convert WebP images to standard JPEG format with customizable background and quality';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
    maxExecutionTimeMs: 10000,
    allowedMimeTypes: ['image/webp'],
  };

  validateInput(input: unknown): WebpToJpgInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, quality, backgroundColor, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    return {
      fileData,
      quality: typeof quality === 'number' && quality >= 1 && quality <= 100 ? quality : 85,
      backgroundColor: typeof backgroundColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(backgroundColor) ? backgroundColor : '#FFFFFF',
      filename: sanitizeFilename(filename, 'converted', 'jpg'),
    };
  }

  async execute(input: WebpToJpgInput, _context: UtilityExecutionContext): Promise<WebpToJpgOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 20971520;
    if (buffer.length > maxBytes) {
      throw new Error(`File size exceeds the 20MB limit`);
    }

    validateWebpMagicBytes(buffer);

    let img: any;
    try {
      img = await loadImage(buffer);
    } catch (err: any) {
      throw new Error(`Failed to decode WebP image: ${err.message}`);
    }

    const { width, height } = img;
    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error('Invalid image dimensions');
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill background color to eliminate black transparent artifacts
    ctx.fillStyle = input.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(img, 0, 0, width, height);

    const q = (input.quality || 85) / 100;
    const jpegBuffer = canvas.toBuffer('image/jpeg', q);
    const dataUrl = bufferToDataUrl(jpegBuffer, 'image/jpeg');

    const outFilename = input.filename?.endsWith('.jpg') ? input.filename : `${input.filename || 'converted'}.jpg`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: jpegBuffer.length,
      width,
      height,
    };
  }
}
