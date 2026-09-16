/**
 * Backend File Security & Malware Shield Utility
 *
 * Enforces:
 * 1. 200MB max file size validation.
 * 2. Binary Magic Header inspection on base64 and buffer payloads.
 * 3. Immediate rejection of ZIP archives, executables, ELF binaries, and scripts.
 */

export const BACKEND_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// Dangerous Executable / Archive Magic Signatures
export function inspectBufferMagic(buffer: Buffer): {
  isDangerous: boolean;
  reason?: string;
} {
  if (!buffer || buffer.length === 0) {
    return { isDangerous: false };
  }

  const b = buffer;

  // 1. ZIP / Archive detection (PK..)
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) && (b[3] === 0x04 || b[3] === 0x06 || b[3] === 0x08)) {
    return { isDangerous: true, reason: 'ZIP compressed archive format is prohibited' };
  }

  // 2. DOS / PE Windows Executable (MZ)
  if (b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a) {
    return { isDangerous: true, reason: 'Windows Executable binary (MZ/PE) is prohibited' };
  }

  // 3. Linux ELF binary (.ELF)
  if (b.length >= 4 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) {
    return { isDangerous: true, reason: 'Linux ELF binary executable is prohibited' };
  }

  // 4. Mach-O macOS binary
  if (
    b.length >= 4 &&
    ((b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa && (b[3] === 0xce || b[3] === 0xcf)) ||
      (b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) ||
      (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe))
  ) {
    return { isDangerous: true, reason: 'macOS Mach-O binary executable is prohibited' };
  }

  // 5. Hashbang script (#!)
  if (b.length >= 2 && b[0] === 0x23 && b[1] === 0x21) {
    return { isDangerous: true, reason: 'Interpreted shell script payload is prohibited' };
  }

  // 6. RAR Archive (Rar!)
  if (b.length >= 4 && b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) {
    return { isDangerous: true, reason: 'RAR archive format is prohibited' };
  }

  // 7. 7-Zip Archive (7z)
  if (b.length >= 6 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c) {
    return { isDangerous: true, reason: '7-Zip archive format is prohibited' };
  }

  // 8. Gzip archive
  if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) {
    return { isDangerous: true, reason: 'Gzip compressed container is prohibited' };
  }

  return { isDangerous: false };
}

/**
 * Validate base64 input for max size and binary security.
 */
export function validateBase64Security(
  base64Data: string,
  maxBytes: number = BACKEND_MAX_FILE_SIZE
): { valid: boolean; error?: string; buffer?: Buffer } {
  if (!base64Data) {
    return { valid: false, error: 'File data is missing' };
  }

  // Clean data URL prefix if present (e.g. data:image/png;base64,...)
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.length > maxBytes) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `Payload (${sizeMb}MB) exceeds ${maxMb}MB limit` };
  }

  const inspection = inspectBufferMagic(buffer);
  if (inspection.isDangerous) {
    return { valid: false, error: `Security Alert: ${inspection.reason}` };
  }

  return { valid: true, buffer };
}
