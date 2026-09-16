import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  ImageResizerInput,
  ImageResizerOutput,
} from '@ad-utility/shared';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  parseBase64Payload,
  bufferToDataUrl,
  detectImageFormat,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class ImageResizerAdapter implements UtilityAdapter<ImageResizerInput, ImageResizerOutput> {
  readonly slug = 'image-resizer';
  readonly name = 'Image Resizer';
  readonly description = 'Resize images with precision, aspect-ratio preservation, and high fidelity';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  };

  validateInput(input: unknown): ImageResizerInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, width, height, scalePercent, maintainAspectRatio, format, quality, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    return {
      fileData,
      width: typeof width === 'number' && width > 0 ? Math.round(width) : undefined,
      height: typeof height === 'number' && height > 0 ? Math.round(height) : undefined,
      scalePercent: typeof scalePercent === 'number' && scalePercent > 0 && scalePercent <= 500 ? scalePercent : undefined,
      maintainAspectRatio: maintainAspectRatio !== false,
      format: format === 'image/jpeg' || format === 'image/webp' ? format : 'image/png',
      quality: typeof quality === 'number' && quality >= 1 && quality <= 100 ? quality : 85,
      filename: sanitizeFilename(filename, 'resized-image'),
    };
  }

  async execute(input: ImageResizerInput, _context: UtilityExecutionContext): Promise<ImageResizerOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`File size exceeds the 200MB limit`);
    }

    const detected = detectImageFormat(buffer);

    let img: any;
    try {
      img = await loadImage(buffer);
    } catch (err: any) {
      throw new Error(`Failed to decode image: ${err.message}`);
    }

    const origWidth = img.width;
    const origHeight = img.height;

    if (!origWidth || !origHeight || origWidth <= 0 || origHeight <= 0) {
      throw new Error('Invalid image dimensions');
    }

    // Guard against decompression bombs
    if (origWidth > 12000 || origHeight > 12000) {
      throw new Error('Image dimensions exceed the maximum allowed limit of 12,000 pixels');
    }

    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (input.scalePercent) {
      const scale = input.scalePercent / 100;
      targetWidth = Math.max(1, Math.round(origWidth * scale));
      targetHeight = Math.max(1, Math.round(origHeight * scale));
    } else if (input.width && input.height) {
      if (input.maintainAspectRatio) {
        const scale = Math.min(input.width / origWidth, input.height / origHeight);
        targetWidth = Math.max(1, Math.round(origWidth * scale));
        targetHeight = Math.max(1, Math.round(origHeight * scale));
      } else {
        targetWidth = input.width;
        targetHeight = input.height;
      }
    } else if (input.width) {
      targetWidth = input.width;
      targetHeight = input.maintainAspectRatio ? Math.max(1, Math.round((origHeight * input.width) / origWidth)) : origHeight;
    } else if (input.height) {
      targetHeight = input.height;
      targetWidth = input.maintainAspectRatio ? Math.max(1, Math.round((origWidth * input.height) / origHeight)) : origWidth;
    }

    // Safety ceiling
    targetWidth = Math.min(targetWidth, 10000);
    targetHeight = Math.min(targetHeight, 10000);

    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    // Fill white background for JPEG
    const targetFormat = input.format || (detected === 'image/jpeg' ? 'image/jpeg' : 'image/png');
    if (targetFormat === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const q = (input.quality || 85) / 100;
    let outBuffer: Buffer;
    if (targetFormat === 'image/jpeg') {
      outBuffer = canvas.toBuffer('image/jpeg', q);
    } else if (targetFormat === 'image/webp') {
      outBuffer = canvas.toBuffer('image/webp', q);
    } else {
      outBuffer = canvas.toBuffer('image/png');
    }

    const dataUrl = bufferToDataUrl(outBuffer, targetFormat);
    const ext = targetFormat === 'image/jpeg' ? 'jpg' : targetFormat === 'image/webp' ? 'webp' : 'png';
    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'resized-image';
    const outFilename = `${baseName}.${ext}`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: outBuffer.length,
      originalWidth: origWidth,
      originalHeight: origHeight,
      newWidth: targetWidth,
      newHeight: targetHeight,
      format: targetFormat,
    };
  }
}
