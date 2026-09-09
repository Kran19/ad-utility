import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfRotatorInput,
  PdfRotatorOutput,
} from '@ad-utility/shared';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfRotatorAdapter implements UtilityAdapter<PdfRotatorInput, PdfRotatorOutput> {
  readonly slug = 'pdf-rotator';
  readonly name = 'PDF Rotator';
  readonly description = 'Rotate PDF pages permanently by 90°, 180°, or 270° with layout preservation';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 30 * 1024 * 1024, // 30MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfRotatorInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData" and "angle"');
    }
    const { fileData, angle, pages, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    const validAngles = [90, 180, 270];
    const parsedAngle = typeof angle === 'number' ? angle : parseInt(angle, 10);
    if (!validAngles.includes(parsedAngle)) {
      throw new Error('Rotation angle must be 90, 180, or 270 degrees');
    }

    return {
      fileData,
      angle: parsedAngle as 90 | 180 | 270,
      pages: Array.isArray(pages) ? pages : 'ALL',
      filename: sanitizeFilename(filename, 'document', 'pdf'),
    };
  }

  async execute(input: PdfRotatorInput, _context: UtilityExecutionContext): Promise<PdfRotatorOutput> {
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

    const angleToAdd = input.angle;
    const pages = pdfDoc.getPages();

    let targetPageIndices: number[] = [];
    if (input.pages === 'ALL' || !Array.isArray(input.pages)) {
      targetPageIndices = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      targetPageIndices = input.pages
        .map((p) => p - 1)
        .filter((idx) => idx >= 0 && idx < totalPages);
    }

    for (const idx of targetPageIndices) {
      const page = pages[idx];
      const currentRotation = page.getRotation().angle;
      const newRotation = (currentRotation + angleToAdd) % 360;
      page.setRotation(degrees(newRotation));
    }

    const modifiedBytes = await pdfDoc.save();
    const modifiedBuffer = Buffer.from(modifiedBytes);
    const dataUrl = bufferToDataUrl(modifiedBuffer, 'application/pdf');

    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'document';
    const outFilename = `${baseName}_rotated_${input.angle}deg.pdf`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: modifiedBuffer.length,
      pageCount: totalPages,
      rotatedAngle: input.angle,
    };
  }
}
