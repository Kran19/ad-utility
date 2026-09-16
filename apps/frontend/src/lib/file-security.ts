/**
 * Enterprise File Security & Validation Guard
 *
 * Enforces:
 * 1. Strict 200MB maximum file size limit across all utilities.
 * 2. Complete blacklisting of all ZIP archives, compressed packages, executable binaries, and script payloads.
 * 3. Binary Magic Byte & File Signature Verification (detects renamed .exe / .zip disguised as .jpg, .png, .pdf, etc.).
 * 4. Whitelisted MIME & extension validation tailored per tool category.
 */

export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB in bytes
export const MAX_FILE_SIZE_LABEL = '200MB';

// Prohibited Dangerous Extensions
const DANGEROUS_EXTENSIONS = new Set([
  // Archives & Compressed Containers
  'zip', 'rar', '7z', 'tar', 'gz', 'gzip', 'bz2', 'bzip2', 'xz', 'iso', 'cab', 'dmg', 'tgz', 'tbz2', 'z', 'lz', 'lzma',
  // Executable Binaries & Installers
  'exe', 'msi', 'dll', 'sys', 'drv', 'bin', 'com', 'scr', 'cpl', 'gadget', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'ipa',
  // Scripts & Interpreted Payloads
  'bat', 'cmd', 'sh', 'bash', 'zsh', 'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'js', 'mjs', 'cjs', 'jse', 'wsf', 'wsh', 'hta',
  'php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'py', 'pyc', 'pyo', 'pyw', 'pl', 'pm', 'cgi', 'jar', 'class', 'asp', 'aspx', 'jsp',
]);

// Prohibited Dangerous MIME Types
const DANGEROUS_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-msdownload',
  'application/x-dosexec',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/javascript',
  'text/javascript',
  'application/x-php',
  'text/x-php',
  'application/x-python',
  'text/x-python',
  'application/x-msi',
  'application/java-archive',
  'application/vnd.android.package-archive',
]);

export interface FileValidationOptions {
  category?: 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'any';
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  allowedMimes?: string[];
  utilitySlug?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
  detectedType?: string;
}

/**
 * Read the first N bytes of a File object for binary header inspection.
 */
export async function readFileMagicBytes(file: File, length = 16): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const arrayBuffer = await slice.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Detect known binary magic signatures.
 */
export function inspectMagicHeader(bytes: Uint8Array): {
  isZip: boolean;
  isExecutable: boolean;
  isElf: boolean;
  isMachO: boolean;
  isScript: boolean;
  isRar: boolean;
  is7z: boolean;
  isGzip: boolean;
  isJpeg: boolean;
  isPng: boolean;
  isWebp: boolean;
  isPdf: boolean;
  isGif: boolean;
  isBmp: boolean;
} {
  const b = bytes;
  const isZip = b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) && (b[3] === 0x04 || b[3] === 0x06 || b[3] === 0x08);
  const isExecutable = b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a; // DOS MZ / PE executable
  const isElf = b.length >= 4 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46; // Linux ELF
  const isMachO =
    b.length >= 4 &&
    ((b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa && (b[3] === 0xce || b[3] === 0xcf)) ||
      (b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) ||
      (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe));
  const isScript = b.length >= 2 && b[0] === 0x23 && b[1] === 0x21; // #! Hashbang script
  const isRar = b.length >= 4 && b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21; // Rar!
  const is7z = b.length >= 6 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c; // 7z
  const isGzip = b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;

  const isJpeg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  const isWebp = b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  const isPdf = b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
  const isGif = b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38; // GIF8
  const isBmp = b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d; // BM

  return {
    isZip,
    isExecutable,
    isElf,
    isMachO,
    isScript,
    isRar,
    is7z,
    isGzip,
    isJpeg,
    isPng,
    isWebp,
    isPdf,
    isGif,
    isBmp,
  };
}

/**
 * Perform comprehensive, synchronous and asynchronous security checks on an uploaded file.
 */
export async function validateFileSecurity(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const maxBytes = options.maxSizeBytes || MAX_FILE_SIZE_BYTES;

  // 1. File size check (200MB limit)
  if (file.size > maxBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size (${sizeMb}MB) exceeds the ${maxMb}MB maximum limit. Please upload a smaller file.`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The uploaded file is empty (0 bytes). Please select a valid file.',
    };
  }

  // 2. Extension check
  const rawName = file.name || '';
  const parts = rawName.split('.');
  const ext = parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Security Alert: Uploading archives, compressed files (.${ext}), executable binaries, or script files is strictly prohibited.`,
    };
  }

  // 3. MIME type check
  const mime = (file.type || '').toLowerCase();
  if (DANGEROUS_MIMES.has(mime)) {
    return {
      valid: false,
      error: `Security Alert: Prohibited file format detected (${mime}). Executable and archive formats cannot be processed.`,
    };
  }

  // 4. Binary Header & Magic Byte Inspection
  try {
    const magicBytes = await readFileMagicBytes(file, 16);
    const magic = inspectMagicHeader(magicBytes);

    if (magic.isZip || magic.isRar || magic.is7z || magic.isGzip) {
      return {
        valid: false,
        error: 'Security Alert: Compressed ZIP/archive payload detected inside file stream. Archive files are not allowed.',
      };
    }

    if (magic.isExecutable || magic.isElf || magic.isMachO || magic.isScript) {
      return {
        valid: false,
        error: 'Security Alert: Malicious or executable binary signature detected. Executable binaries and scripts are blocked.',
      };
    }

    // 5. Category-Specific Validation
    if (options.category === 'image') {
      const allowedImageExts = options.allowedExtensions || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
      if (ext && !allowedImageExts.includes(ext)) {
        return {
          valid: false,
          error: `Please select a supported image file (${allowedImageExts.map((e) => `.${e}`).join(', ')}).`,
        };
      }

      // Check specific image tool targets
      if (options.utilitySlug === 'jpg-to-png' || options.utilitySlug === 'jpg-to-webp') {
        if (!['jpg', 'jpeg'].includes(ext) && !magic.isJpeg) {
          return { valid: false, error: 'Please select a valid JPG or JPEG image file.' };
        }
      } else if (options.utilitySlug === 'png-to-jpg' || options.utilitySlug === 'png-to-webp') {
        if (ext !== 'png' && !magic.isPng) {
          return { valid: false, error: 'Please select a valid PNG image file.' };
        }
      } else if (options.utilitySlug === 'webp-to-jpg') {
        if (ext !== 'webp' && !magic.isWebp) {
          return { valid: false, error: 'Please select a valid WebP image file.' };
        }
      }
    } else if (options.category === 'pdf') {
      if (ext !== 'pdf' && !magic.isPdf) {
        return {
          valid: false,
          error: 'Please select a valid PDF document (.pdf).',
        };
      }
    } else if (options.category === 'video') {
      const allowedVideoExts = options.allowedExtensions || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];
      if (ext && !allowedVideoExts.includes(ext)) {
        return {
          valid: false,
          error: `Please select a supported video file (${allowedVideoExts.map((e) => `.${e}`).join(', ')}).`,
        };
      }
    } else if (options.category === 'audio') {
      const allowedAudioExts = options.allowedExtensions || ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
      if (ext && !allowedAudioExts.includes(ext)) {
        return {
          valid: false,
          error: `Please select a supported audio file (${allowedAudioExts.map((e) => `.${e}`).join(', ')}).`,
        };
      }
    }
  } catch (err: any) {
    // If reading arrayBuffer fails for any reason, perform safe fallback
    return {
      valid: false,
      error: `Could not verify file integrity: ${err.message || 'Unknown error'}`,
    };
  }

  return {
    valid: true,
    sanitizedFilename: rawName.replace(/[^a-zA-Z0-9._-]/g, '_'),
  };
}
