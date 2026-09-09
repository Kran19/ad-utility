import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  ImageCropperInput,
  ImageCropperOutput,
} from '@ad-utility/shared';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  parseBase64Payload,
  bufferToDataUrl,
  detectImageFormat,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class ImageCropperAdapter implements UtilityAdapter<ImageCropperInput, ImageCropperOutput> {
  readonly slug = 'image-cropper';
  readonly name = 'Image Cropper';
  readonly description = 'Crop images to exact dimensions, aspect ratios, or custom bounding boxes';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
    maxExecutionTimeMs: 10000,
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  };

  validateInput(input: unknown): ImageCropperInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with crop parameters');
    }
    const { fileData, x, y, width, height, rotateDegrees, format, quality, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    if (typeof width !== 'number' || width <= 0 || typeof height !== 'number' || height <= 0) {
      throw new Error('Crop "width" and "height" must be positive numbers');
    }

    return {
      fileData,
      x: typeof x === 'number' ? Math.max(0, Math.round(x)) : 0,
      y: typeof y === 'number' ? Math.max(0, Math.round(y)) : 0,
      width: Math.round(width),
      height: Math.round(height),
      rotateDegrees: rotateDegrees === 90 || rotateDegrees === 180 || rotateDegrees === 270 ? rotateDegrees : 0,
      format: format === 'image/jpeg' || format === 'image/webp' ? format : 'image/png',
      quality: typeof quality === 'number' && quality >= 1 && quality <= 100 ? quality : 85,
      filename: sanitizeFilename(filename, 'cropped-image'),
    };
  }

  async execute(input: ImageCropperInput, _context: UtilityExecutionContext): Promise<ImageCropperOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 20971520;
    if (buffer.length > maxBytes) {
      throw new Error(`File size (${Math.round(buffer.length / 1024)}KB) exceeds the 20MB limit`);
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

    // Bounds checking
    const cropX = Math.min(input.x, origWidth - 1);
    const cropY = Math.min(input.y, origHeight - 1);
    const cropW = Math.min(input.width, origWidth - cropX);
    const cropH = Math.min(input.height, origHeight - cropY);

    if (cropW <= 0 || cropH <= 0) {
      throw new Error('Crop coordinates are outside image boundaries');
    }

    // Handle rotation if requested
    const rotate = input.rotateDegrees || 0;
    const isRotated90or270 = rotate === 90 || rotate === 270;
    const finalW = isRotated90or270 ? cropH : cropW;
    const finalH = isRotated90or270 ? cropW : cropH;

    const canvas = createCanvas(finalW, finalH);
    const ctx = canvas.getContext('2d');

    const targetFormat = input.format || (detected === 'image/jpeg' ? 'image/jpeg' : 'image/png');
    if (targetFormat === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalW, finalH);
    }

    if (rotate !== 0) {
      ctx.save();
      ctx.translate(finalW / 2, finalH / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(img, cropX, cropY, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);
      ctx.restore();
    } else {
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    }

    const q = (input.quality || 85) / 100;
    let outBuffer: Buffer;
    if (targetFormat === 'image/jpeg') {
      outBuffer = canvas.toBuffer('image/jpeg', { quality: q });
    } else if (targetFormat === 'image/webp') {
      outBuffer = canvas.toBuffer('image/webp', { quality: q });
    } else {
      outBuffer = canvas.toBuffer('image/png');
    }

    const dataUrl = bufferToDataUrl(outBuffer, targetFormat);
    const ext = targetFormat === 'image/jpeg' ? 'jpg' : targetFormat === 'image/webp' ? 'webp' : 'png';
    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'cropped-image';
    const outFilename = `${baseName}.${ext}`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: outBuffer.length,
      width: finalW,
      height: finalH,
      format: targetFormat,
    };
  }
}
