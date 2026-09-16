import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  JpgToPngInput,
  JpgToPngOutput,
} from '@ad-utility/shared';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validateJpegMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class JpgToPngAdapter implements UtilityAdapter<JpgToPngInput, JpgToPngOutput> {
  readonly slug = 'jpg-to-png';
  readonly name = 'JPG to PNG Converter';
  readonly description = 'Convert JPG and JPEG images to lossless PNG format safely';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['image/jpeg', 'image/jpg'],
  };

  validateInput(input: unknown): JpgToPngInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required (base64 or data URL)');
    }

    return {
      fileData,
      filename: sanitizeFilename(filename, 'converted', 'png'),
    };
  }

  async execute(input: JpgToPngInput, _context: UtilityExecutionContext): Promise<JpgToPngOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`File size exceeds the 200MB limit`);
    }

    // Authoritative magic bytes verification
    validateJpegMagicBytes(buffer);

    // Decode JPEG to raw RGBA
    let decoded: any;
    try {
      decoded = jpeg.decode(buffer);
    } catch (err: any) {
      throw new Error(`Failed to decode JPEG image: ${err.message}`);
    }

    const { width, height, data } = decoded;
    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error('Decoded image has invalid dimensions');
    }

    // Create PNG with same dimensions and RGBA buffer
    const png = new PNG({ width, height });
    png.data = Buffer.from(data.buffer, data.byteOffset, data.byteLength);

    const pngBuffer = PNG.sync.write(png);
    const dataUrl = bufferToDataUrl(pngBuffer, 'image/png');

    const outFilename = input.filename?.endsWith('.png')
      ? input.filename
      : `${input.filename?.replace(/\.[^/.]+$/, '') || 'converted'}.png`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: pngBuffer.length,
      width,
      height,
    };
  }
}
