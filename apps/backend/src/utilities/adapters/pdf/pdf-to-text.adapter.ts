import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  PdfToTextInput,
  PdfToTextOutput,
} from '@ad-utility/shared';
import {
  parseBase64Payload,
  validatePdfMagicBytes,
  sanitizeFilename,
} from '../utils/buffer-utils';

export class PdfToTextAdapter implements UtilityAdapter<PdfToTextInput, PdfToTextOutput> {
  readonly slug = 'pdf-to-text';
  readonly name = 'PDF to Text';
  readonly description = 'Extract selectable text from PDF documents cleanly with preserved structure (Note: extracts digital text, not OCR)';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
    maxExecutionTimeMs: 15000,
    allowedMimeTypes: ['application/pdf'],
  };

  validateInput(input: unknown): PdfToTextInput {
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

  async execute(input: PdfToTextInput, _context: UtilityExecutionContext): Promise<PdfToTextOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 20971520;
    if (buffer.length > maxBytes) {
      throw new Error(`PDF file size exceeds the 20MB limit`);
    }

    validatePdfMagicBytes(buffer);

    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const pdfjs = await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');

    let pdfDoc: any;
    try {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableWorker: true,
        isEvalSupported: false,
      });
      pdfDoc = await loadingTask.promise;
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }

    const totalPages = pdfDoc.numPages;
    if (totalPages === 0) {
      throw new Error('PDF contains no pages to extract text from');
    }

    const pageTexts: string[] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const items = textContent.items || [];
      const lines: string[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const item of items) {
        if (!item.str) continue;
        const y = item.transform ? item.transform[5] : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 5) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = item.str;
        } else {
          currentLine += (currentLine ? ' ' : '') + item.str;
        }
        lastY = y;
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }

      const pageJoined = lines.join('\n');
      pageTexts.push(`--- Page ${pageNum} ---\n${pageJoined}`);
      totalChars += pageJoined.length;
    }

    const fullText = pageTexts.join('\n\n');
    const hasSelectableText = totalChars > 0;
    const words = fullText.trim().split(/\s+/).filter(Boolean);

    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'document';
    const outFilename = `${baseName}_extracted.txt`;

    return {
      text: fullText,
      filename: outFilename,
      pageCount: totalPages,
      charCount: totalChars,
      wordCount: words.length,
      hasSelectableText,
    };
  }
}
