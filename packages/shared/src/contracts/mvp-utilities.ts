/**
 * Input and Output Contracts for MVP Utilities Catalog
 */

// ==========================================
// 1. IMAGE UTILITIES
// ==========================================

export interface JpgToPngInput {
  /** Base64-encoded image data or data URL */
  fileData: string;
  /** Original filename for context (optional) */
  filename?: string;
}

export interface JpgToPngOutput {
  /** Converted Base64 data URL for PNG */
  dataUrl: string;
  /** Suggested download filename */
  filename: string;
  /** Resulting PNG byte size */
  sizeBytes: number;
  /** Image dimensions */
  width: number;
  height: number;
}

export interface PngToJpgInput {
  /** Base64-encoded image data or data URL */
  fileData: string;
  /** Compression quality between 1 and 100 (default: 85) */
  quality?: number;
  /** Original filename for context (optional) */
  filename?: string;
}

export interface PngToJpgOutput {
  /** Converted Base64 data URL for JPEG */
  dataUrl: string;
  /** Suggested download filename */
  filename: string;
  /** Resulting JPEG byte size */
  sizeBytes: number;
  /** Image dimensions */
  width: number;
  height: number;
  /** Note on background alpha flattening strategy */
  background: string;
}

export interface ImageCompressorInput {
  /** Base64-encoded image data or data URL (JPEG or PNG) */
  fileData: string;
  /** Target compression quality (1-100, default: 70) */
  quality?: number;
  /** Original filename */
  filename?: string;
}

export interface ImageCompressorOutput {
  /** Compressed Base64 data URL */
  dataUrl: string;
  /** Output filename */
  filename: string;
  /** Original byte size before compression */
  originalSizeBytes: number;
  /** Compressed byte size after compression */
  compressedSizeBytes: number;
  /** Percentage saved (e.g. 35.5%) */
  savingsPercent: number;
  /** MIME format */
  format: 'image/jpeg' | 'image/png';
}

// ==========================================
// 2. PDF UTILITIES
// ==========================================

export type PdfCompressionProfile = 'VISUALLY_LOSSLESS' | 'BALANCED' | 'EXTREME';
export type PdfCompressionLevel = 'extreme' | 'recommended' | 'low';

export interface PdfCompressorInput {
  /** Base64-encoded PDF data or data URL */
  fileData: string;
  /** Original filename */
  filename?: string;
  /** Compression profile: EXTREME (default, target ≤1MB), BALANCED (recommended), VISUALLY_LOSSLESS (high fidelity) */
  profile?: PdfCompressionProfile;
  /** Backwards compatibility alias for profile */
  compressionLevel?: PdfCompressionLevel;
}

export interface PdfCompressorOutput {
  /** Optimized/compressed Base64 PDF data URL */
  dataUrl: string;
  /** Output filename */
  filename: string;
  /** Original byte size */
  originalSizeBytes: number;
  /** Compressed byte size */
  compressedSizeBytes: number;
  /** Absolute bytes saved */
  savedBytes: number;
  /** Percentage saved (0-100) */
  savingsPercent: number;
  /** Compression ratio (original / compressed) */
  compressionRatio: number;
  /** Applied compression profile */
  profile: PdfCompressionProfile;
  /** True if output is materially smaller than input */
  wasActuallyCompressed: boolean;
  /** Total page count */
  pageCount: number;
}

export interface PdfMergeInput {
  /** Array of Base64-encoded PDF files in desired order (2 to 10 files) */
  files: Array<{
    fileData: string;
    filename?: string;
  }>;
}

export interface PdfMergeOutput {
  /** Merged Base64 PDF data URL */
  dataUrl: string;
  /** Output filename */
  filename: string;
  /** Combined size in bytes */
  sizeBytes: number;
  /** Total combined page count */
  totalPageCount: number;
  /** Source file count */
  mergedFileCount: number;
}

export interface PdfSplitInput {
  /** Base64-encoded PDF data */
  fileData: string;
  /** Page range expression (e.g. '1-3,5,8-10') */
  pageRanges: string;
  /** Original filename */
  filename?: string;
}

export interface PdfSplitOutput {
  /** Result Base64 data URL (PDF if single range/extracted doc, or ZIP data URL if multiple parts) */
  dataUrl: string;
  /** Output filename */
  filename: string;
  /** Extracted pages array */
  extractedPages: number[];
  /** MIME type of output */
  mimeType: 'application/pdf' | 'application/zip';
  /** Total byte size */
  sizeBytes: number;
}

export interface PdfToJpgInput {
  /** Base64-encoded PDF data */
  fileData: string;
  /** Optional specific page number (1-indexed) or 'all' */
  page?: number | 'all';
  /** Rendering scale (default 1.5 for crisp preview) */
  scale?: number;
  /** Original filename */
  filename?: string;
}

export interface PdfToJpgOutput {
  /** Base64 data URL (JPEG for single page, ZIP of JPEGs for multiple pages) */
  dataUrl: string;
  /** Output filename */
  filename: string;
  /** Number of rendered pages */
  renderedPages: number;
  /** Total bytes of output */
  sizeBytes: number;
  /** MIME type */
  mimeType: 'image/jpeg' | 'application/zip';
}

// ==========================================
// 3. TEXT UTILITIES
// ==========================================

export interface TextCleanerInput {
  text: string;
  options?: {
    trimWhitespace?: boolean;
    collapseSpaces?: boolean;
    removeEmptyLines?: boolean;
    normalizeLineEndings?: boolean;
    convertTabsToSpaces?: boolean;
    tabSpaces?: number;
  };
}

export interface TextCleanerOutput {
  cleanedText: string;
  originalCharCount: number;
  cleanedCharCount: number;
  linesRemoved: number;
  spacesCollapsed: number;
}

export type CaseConversionType =
  | 'uppercase'
  | 'lowercase'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'snake'
  | 'kebab';

export interface CaseConverterInput {
  text: string;
  targetCase: CaseConversionType;
}

export interface CaseConverterOutput {
  convertedText: string;
  caseType: CaseConversionType;
  wordCount: number;
  characterCount: number;
}

// ==========================================
// 4. AI UTILITIES
// ==========================================

export interface AiHumanizerInput {
  text: string;
  tone?: 'standard' | 'formal' | 'casual' | 'academic' | 'creative';
}

export interface AiHumanizerOutput {
  humanizedText: string;
  originalWordCount: number;
  resultWordCount: number;
  tone: string;
  model: string;
}

export interface AiParaphraserInput {
  text: string;
  style?: 'standard' | 'fluent' | 'creative' | 'concise';
}

export interface AiParaphraserOutput {
  paraphrasedText: string;
  originalWordCount: number;
  resultWordCount: number;
  style: string;
  model: string;
}

export interface GrammarIssue {
  original: string;
  correction: string;
  type: 'grammar' | 'spelling' | 'punctuation' | 'style';
  explanation: string;
}

export interface AiGrammarCheckerInput {
  text: string;
}

export interface AiGrammarCheckerOutput {
  correctedText: string;
  issueCount: number;
  issues: GrammarIssue[];
  overallFeedback: string;
  model: string;
}
