/**
 * Security and buffer validation utilities for file-based adapters
 */

export function parseBase64Payload(input: string): { buffer: Buffer; mimeType?: string } {
  if (!input || typeof input !== 'string') {
    throw new Error('Payload must be a valid base64 or data URL string');
  }

  // Handle data URL prefix (e.g. data:image/png;base64,iVBORw0KGgo...)
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    const mimeType = match[1].toLowerCase().trim();
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    return { buffer, mimeType };
  }

  // Raw base64 string
  const buffer = Buffer.from(input, 'base64');
  return { buffer };
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export function validateJpegMagicBytes(buffer: Buffer): void {
  if (buffer.length < 3) {
    throw new Error('File payload too small to be a valid JPEG');
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw new Error('Invalid JPEG file signature (magic bytes mismatch). File is not a valid JPEG.');
  }
}

export function validatePngMagicBytes(buffer: Buffer): void {
  if (buffer.length < 8) {
    throw new Error('File payload too small to be a valid PNG');
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngSignature[i]) {
      throw new Error('Invalid PNG file signature (magic bytes mismatch). File is not a valid PNG.');
    }
  }
}

export function validateWebpMagicBytes(buffer: Buffer): void {
  if (buffer.length < 12) {
    throw new Error('File payload too small to be a valid WebP');
  }
  const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  if (!isRiff || !isWebp) {
    throw new Error('Invalid WebP file signature (magic bytes mismatch). File is not a valid WebP.');
  }
}

export function detectImageFormat(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  throw new Error('Unsupported or unrecognized image format. Only JPEG, PNG, and WebP are supported.');
}

export function validatePdfMagicBytes(buffer: Buffer): void {
  if (buffer.length < 5) {
    throw new Error('File payload too small to be a valid PDF');
  }
  // Reject executable binaries attempting to masquerade as PDF (PE or ELF)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    throw new Error('Invalid PDF file signature (executable binary detected). File is not a valid PDF.');
  }
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    throw new Error('Invalid PDF file signature (executable binary detected). File is not a valid PDF.');
  }

  const header = buffer.subarray(0, 1024).toString('binary');
  if (!header.includes('%PDF-')) {
    throw new Error('Invalid PDF file signature (missing %PDF- header). File is not a valid PDF.');
  }
}

export function sanitizeFilename(name?: string, fallback = 'file', ext = ''): string {
  if (!name || typeof name !== 'string') {
    return `${fallback}${ext ? '.' + ext : ''}`;
  }

  // 1. Strip null bytes and control characters (ASCII 0-31)
  let clean = name.replace(/[\x00-\x1F\x7F]/g, '');

  // 2. Extract basename only (strip Windows and POSIX path separators)
  clean = clean.replace(/^.*[\\/]/, '');

  // 3. Keep only safe alphanumeric, dash, dot, and underscore
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');

  // 4. Eliminate dangerous relative path traversal patterns (e.g. '.', '..', '...')
  clean = clean.replace(/^\.+/, ''); // Strip leading dots
  clean = clean.replace(/\.{2,}/g, '.'); // Collapse multiple dots

  // 5. Enforce reasonable length limit (max 100 chars)
  clean = clean.slice(0, 100).trim();

  // If sanitized result is empty or just underscores, return fallback
  if (!clean || clean.replace(/[_.]/g, '').length === 0) {
    return `${fallback}${ext ? '.' + ext : ''}`;
  }

  return clean;
}
