/**
 * Input and Output Contracts for Phase 27 High-Demand Utility Catalog
 */

// ==========================================
// 1. IMAGE UTILITIES (Wave 1 & 2)
// ==========================================

export interface ImageToPdfItem {
  fileData: string;
  filename?: string;
}

export interface ImageToPdfInput {
  /** Single fileData or array of images */
  fileData?: string;
  images?: ImageToPdfItem[];
  pageSize?: 'A4' | 'LETTER' | 'FIT_TO_IMAGE';
  orientation?: 'PORTRAIT' | 'LANDSCAPE' | 'AUTO';
  margin?: number; // In points (default 0 or 20)
  filename?: string;
}

export interface ImageToPdfOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
}

export interface ImageResizerInput {
  fileData: string;
  width?: number;
  height?: number;
  scalePercent?: number; // e.g. 50 for 50%
  maintainAspectRatio?: boolean;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number; // 1-100
  filename?: string;
}

export interface ImageResizerOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  format: string;
}

export interface ImageCropperInput {
  fileData: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotateDegrees?: number; // 0, 90, 180, 270
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
  filename?: string;
}

export interface ImageCropperOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  width: number;
  height: number;
  format: string;
}

export interface WebpToJpgInput {
  fileData: string;
  quality?: number; // 1-100 (default 85)
  backgroundColor?: string; // default #ffffff
  filename?: string;
}

export interface WebpToJpgOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface JpgToWebpInput {
  fileData: string;
  quality?: number; // 1-100 (default 80)
  filename?: string;
}

export interface JpgToWebpOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface PngToWebpInput {
  fileData: string;
  quality?: number; // 1-100 (default 80)
  lossless?: boolean;
  filename?: string;
}

export interface PngToWebpOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  width: number;
  height: number;
}

// ==========================================
// 2. PDF UTILITIES (Wave 1 & 2)
// ==========================================

export interface PdfToPngInput {
  fileData: string;
  filename?: string;
  scale?: number; // default 1.5
  maxPages?: number; // default 20
}

export interface PdfToPngOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
  isZip: boolean;
  pages: Array<{ pageNumber: number; dataUrl: string }>;
}

export interface PdfToTextInput {
  fileData: string;
  filename?: string;
}

export interface PdfToTextOutput {
  text: string;
  filename: string;
  dataUrl?: string;
  sizeBytes?: number;
  pageCount: number;
  charCount: number;
  wordCount: number;
  hasSelectableText: boolean;
}

export interface PdfPageExtractorInput {
  fileData: string;
  pageRanges: string; // e.g. "1-3, 5, 8"
  filename?: string;
}

export interface PdfPageExtractorOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  extractedPages: number[];
  pageCount: number;
}

export interface PdfRotatorInput {
  fileData: string;
  angle: 90 | 180 | 270;
  pages?: 'ALL' | number[]; // default 'ALL'
  filename?: string;
}

export interface PdfRotatorOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
  rotatedAngle: number;
}

export interface PdfReorderInput {
  fileData: string;
  pageOrder: number[]; // 1-based page index order, e.g. [3, 1, 2]
  filename?: string;
}

export interface PdfReorderOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
}

export interface PdfWatermarkInput {
  fileData: string;
  watermarkText: string;
  fontSize?: number; // default 36
  opacity?: number; // 0.1 - 1.0 (default 0.3)
  rotationDegrees?: number; // default 45
  position?: 'CENTER' | 'TOP' | 'BOTTOM' | 'DIAGONAL';
  colorHex?: string; // default #888888
  filename?: string;
}

export interface PdfWatermarkOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
}

export interface PdfMetadataRemoverInput {
  fileData: string;
  filename?: string;
}

export interface PdfMetadataRemoverOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  removedFields: string[];
}

// ==========================================
// 3. DOCUMENT UTILITIES (Wave 2)
// ==========================================

export interface WordToPdfInput {
  fileData: string;
  filename?: string;
}

export interface WordToPdfOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
}

export interface PdfToWordInput {
  fileData: string;
  filename?: string;
}

export interface PdfToWordOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
}

export interface PdfToExcelInput {
  fileData: string;
  filename?: string;
}

export interface PdfToExcelOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  tableCount: number;
}

// ==========================================
// 4. MEDIA UTILITIES (Wave 3 - Video & Audio)
// ==========================================

export interface VideoCompressorInput {
  fileData: string;
  targetQuality?: 'low' | 'medium' | 'high';
  crf?: number; // 18-36 (default 28)
  maxResolution?: '480p' | '720p' | '1080p' | 'original';
  filename?: string;
}

export interface VideoCompressorOutput {
  dataUrl: string;
  filename: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savingsPercent: number;
}

export interface VideoConverterInput {
  fileData: string;
  targetFormat: 'mp4' | 'webm' | 'mov';
  filename?: string;
}

export interface VideoConverterOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  format: string;
}

export interface VideoToGifInput {
  fileData: string;
  startTimeSec?: number;
  durationSec?: number;
  fps?: number; // 5 - 20 (default 10)
  width?: number; // default 480
  filename?: string;
}

export interface VideoToGifOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
}

export interface VideoToJpgInput {
  fileData: string;
  timestampSec?: number;
  intervalSec?: number;
  filename?: string;
}

export interface VideoToJpgOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  frameCount: number;
}

export interface Mp4ToMp3Input {
  fileData: string;
  bitrate?: '128k' | '192k' | '256k' | '320k';
  filename?: string;
}

export interface Mp4ToMp3Output {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
}

export interface VideoTrimmerInput {
  fileData: string;
  startTimeSec: number;
  endTimeSec: number;
  filename?: string;
}

export interface VideoTrimmerOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  durationSec: number;
}

export interface AudioCompressorInput {
  fileData: string;
  bitrate?: '64k' | '96k' | '128k' | '192k';
  filename?: string;
}

export interface AudioCompressorOutput {
  dataUrl: string;
  filename: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savingsPercent: number;
}

export interface AudioConverterInput {
  fileData: string;
  targetFormat: 'mp3' | 'wav' | 'ogg' | 'm4a';
  filename?: string;
}

export interface AudioConverterOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  format: string;
}

export interface AudioCutterInput {
  fileData: string;
  startTimeSec: number;
  endTimeSec: number;
  filename?: string;
}

export interface AudioCutterOutput {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  durationSec: number;
}

// ==========================================
// 5. QR & BARCODE UTILITIES (Wave 1 & 3)
// ==========================================

export interface QrCodeGeneratorInput {
  content: string;
  type?: 'text' | 'url' | 'email' | 'phone' | 'wifi' | 'vcard';
  size?: number; // px (e.g. 256, 512)
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  format?: 'svg' | 'png';
  darkColor?: string;
  lightColor?: string;
}

export interface QrCodeGeneratorOutput {
  dataUrl: string;
  format: string;
  content: string;
}

export interface BarcodeGeneratorInput {
  content: string;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39';
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export interface BarcodeGeneratorOutput {
  dataUrl: string;
  format: string;
  content: string;
}
