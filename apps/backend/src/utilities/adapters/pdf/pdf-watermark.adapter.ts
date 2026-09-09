import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfWatermarkInput,
  PdfWatermarkOutput,
} from '@ad-utility/shared';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfWatermarkAdapter implements UtilityAdapter<PdfWatermarkInput, PdfWatermarkOutput> {
  readonly slug = 'pdf-watermark';
  readonly name = 'PDF Watermark';
  readonly description = 'Apply custom text watermarks across PDF pages with controllable opacity and angles';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 30 * 1024 * 1024, // 30MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfWatermarkInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData" and "watermarkText"');
    }
    const { fileData, watermarkText, fontSize, opacity, rotationDegrees, position, colorHex, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    if (typeof watermarkText !== 'string' || watermarkText.trim().length === 0) {
      throw new Error('Property "watermarkText" is required');
    }

    return {
      fileData,
      watermarkText: watermarkText.trim(),
      fontSize: typeof fontSize === 'number' && fontSize >= 10 && fontSize <= 120 ? fontSize : 42,
      opacity: typeof opacity === 'number' && opacity >= 0.05 && opacity <= 1.0 ? opacity : 0.3,
      rotationDegrees: typeof rotationDegrees === 'number' ? rotationDegrees : 45,
      position: position === 'TOP' || position === 'BOTTOM' || position === 'CENTER' ? position : 'DIAGONAL',
      colorHex: typeof colorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : '#666666',
      filename: sanitizeFilename(filename, 'document', 'pdf'),
    };
  }

  async execute(input: PdfWatermarkInput, _context: UtilityExecutionContext): Promise<PdfWatermarkOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 31457280;
    if (buffer.length > maxBytes) {
      throw new Error(`PDF file size exceeds the 30MB limit`);
    }

    validatePdfMagicBytes(buffer);

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (err: any) {
      throw new Error(`Failed to load PDF document: ${err.message}`);
    }

    const totalPages = pdfDoc.getPageCount();
    if (totalPages === 0) {
      throw new Error('PDF document contains 0 pages');
    }

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = input.fontSize || 42;
    const opacity = input.opacity || 0.3;

    // Parse color hex
    const hex = (input.colorHex || '#666666').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const watermarkColor = rgb(r, g, b);

    const pages = pdfDoc.getPages();
    const text = input.watermarkText;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    for (const page of pages) {
      const { width, height } = page.getSize();
      let x = (width - textWidth) / 2;
      let y = (height - textHeight) / 2;
      let rotateDeg = input.rotationDegrees || 0;

      if (input.position === 'DIAGONAL') {
        rotateDeg = 45;
        x = width / 2 - textWidth / 2.5;
        y = height / 2 - textHeight / 2.5;
      } else if (input.position === 'TOP') {
        y = height - textHeight - 40;
      } else if (input.position === 'BOTTOM') {
        y = 40;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: watermarkColor,
        opacity,
        rotate: degrees(rotateDeg),
      });
    }

    const modifiedBytes = await pdfDoc.save();
    const modifiedBuffer = Buffer.from(modifiedBytes);
    const dataUrl = bufferToDataUrl(modifiedBuffer, 'application/pdf');

    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'document';
    const outFilename = `${baseName}_watermarked.pdf`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: modifiedBuffer.length,
      pageCount: totalPages,
    };
  }
}
