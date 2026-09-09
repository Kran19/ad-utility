import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfMetadataRemoverInput,
  PdfMetadataRemoverOutput,
} from '@ad-utility/shared';
import { PDFDocument } from 'pdf-lib';
import {
  parseBase64Payload,
  bufferToDataUrl,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfMetadataRemoverAdapter implements UtilityAdapter<PdfMetadataRemoverInput, PdfMetadataRemoverOutput> {
  readonly slug = 'pdf-metadata-remover';
  readonly name = 'PDF Metadata Remover';
  readonly description = 'Remove document metadata fields (Title, Author, Subject, Keywords, Producer, Creator) from PDF files safely';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 30 * 1024 * 1024, // 30MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfMetadataRemoverInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    return {
      fileData,
      filename: sanitizeFilename(filename, 'document', 'pdf'),
    };
  }

  async execute(input: PdfMetadataRemoverInput, _context: UtilityExecutionContext): Promise<PdfMetadataRemoverOutput> {
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

    const removedFields = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModificationDate'];

    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');
    pdfDoc.setCreationDate(new Date(0));
    pdfDoc.setModificationDate(new Date(0));

    const cleanedBytes = await pdfDoc.save();
    const cleanedBuffer = Buffer.from(cleanedBytes);
    const dataUrl = bufferToDataUrl(cleanedBuffer, 'application/pdf');

    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'document';
    const outFilename = `${baseName}_clean.pdf`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: cleanedBuffer.length,
      removedFields,
    };
  }
}
