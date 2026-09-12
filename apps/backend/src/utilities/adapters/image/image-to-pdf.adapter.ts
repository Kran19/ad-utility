import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  ImageToPdfInput,
  ImageToPdfOutput,
} from '@ad-utility/shared';
import { PDFDocument, PageSizes } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  detectImageFormat,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class ImageToPdfAdapter implements UtilityAdapter<ImageToPdfInput, ImageToPdfOutput> {
  readonly slug = 'image-to-pdf';
  readonly name = 'Image to PDF Converter';
  readonly description = 'Convert JPG and PNG images into a clean, high-quality PDF document';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 25 * 1024 * 1024, // 25MB total
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
  };

  validateInput(input: unknown): ImageToPdfInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData" or "images"');
    }
    const { fileData, images, pageSize, orientation, margin, filename } = input as any;

    if (!fileData && (!Array.isArray(images) || images.length === 0)) {
      throw new Error('Please provide at least one image in "fileData" or "images"');
    }

    return {
      fileData: typeof fileData === 'string' ? fileData : undefined,
      images: Array.isArray(images) ? images : undefined,
      pageSize: pageSize === 'LETTER' || pageSize === 'FIT_TO_IMAGE' ? pageSize : 'A4',
      orientation: orientation === 'LANDSCAPE' || orientation === 'AUTO' ? orientation : 'PORTRAIT',
      margin: typeof margin === 'number' && margin >= 0 && margin <= 100 ? margin : 20,
      filename: sanitizeFilename(filename, 'converted-images', 'pdf'),
    };
  }

  async execute(input: ImageToPdfInput, _context: UtilityExecutionContext): Promise<ImageToPdfOutput> {
    const rawImages: Array<{ buffer: Buffer; format: string }> = [];

    if (input.images && input.images.length > 0) {
      if (input.images.length > 50) {
        throw new Error('Maximum of 50 images can be combined in a single PDF');
      }
      for (const img of input.images) {
        const rawPayload = typeof img === 'string' ? img : (img as any)?.fileData;
        if (!rawPayload) continue;
        const { buffer } = parseBase64Payload(rawPayload);
        const format = detectImageFormat(buffer);
        rawImages.push({ buffer, format });
      }
    }

    if (rawImages.length === 0 && input.fileData) {
      const { buffer } = parseBase64Payload(input.fileData);
      const format = detectImageFormat(buffer);
      rawImages.push({ buffer, format });
    }

    if (rawImages.length === 0) {
      throw new Error('No valid images were provided for conversion');
    }

    const totalBytes = rawImages.reduce((sum, img) => sum + img.buffer.length, 0);
    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 26214400;
    if (totalBytes > maxBytes) {
      throw new Error(`Combined images size (${Math.round(totalBytes / 1024)}KB) exceeds the 25MB limit`);
    }

    const pdfDoc = await PDFDocument.create();

    for (const img of rawImages) {
      let embeddedImage: any;
      if (img.format === 'image/jpeg') {
        embeddedImage = await pdfDoc.embedJpg(img.buffer);
      } else if (img.format === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(img.buffer);
      } else {
        throw new Error(`Unsupported image format for PDF embedding: ${img.format}`);
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      if (input.pageSize === 'FIT_TO_IMAGE') {
        const page = pdfDoc.addPage([imgWidth, imgHeight]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: imgWidth,
          height: imgHeight,
        });
      } else {
        let baseSize = input.pageSize === 'LETTER' ? PageSizes.Letter : PageSizes.A4;
        let [pageWidth, pageHeight] = baseSize;

        let isLandscape = input.orientation === 'LANDSCAPE';
        if (input.orientation === 'AUTO' && imgWidth > imgHeight) {
          isLandscape = true;
        }

        if (isLandscape && pageWidth < pageHeight) {
          [pageWidth, pageHeight] = [pageHeight, pageWidth];
        }

        const margin = input.margin || 20;
        const maxContentWidth = pageWidth - margin * 2;
        const maxContentHeight = pageHeight - margin * 2;

        const scale = Math.min(maxContentWidth / imgWidth, maxContentHeight / imgHeight, 1.0);
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;

        const x = margin + (maxContentWidth - drawWidth) / 2;
        const y = margin + (maxContentHeight - drawHeight) / 2;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(embeddedImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const dataUrl = bufferToDataUrl(pdfBuffer, 'application/pdf');

    const baseName = (input.filename || 'converted-images').replace(/\.[^/.]+$/, '');
    const outFilename = `${baseName}.pdf`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: pdfBuffer.length,
      pageCount: rawImages.length,
    };
  }
}
