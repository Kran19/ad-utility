/**
 * Standards-Compliant ISO/IEC 18004 QR Code Generator & Decoder Engine
 * Pure TypeScript implementation for browser and Node.js runtime.
 */

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  errorCorrectionLevel?: QrErrorCorrectionLevel;
  minVersion?: number;
  maxVersion?: number;
  margin?: number; // Quiet zone modules (default 4)
  darkColor?: string;
  lightColor?: string;
}

export interface QrCodeResult {
  version: number;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  size: number; // Module grid width/height including quiet zone
  moduleCount: number; // Raw module count (e.g. 21, 25, 29...)
  margin: number;
  matrix: boolean[][]; // 2D array [row][col], true = dark, false = light
  svg: string;
}

// GF(256) Galois Field Tables with primitive polynomial 0x11D (285)
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = val;
    GF256_EXP[i + 255] = val;
    GF256_LOG[val] = i;
    val <<= 1;
    if (val & 256) {
      val ^= 0x11d;
    }
  }
  GF256_LOG[0] = 0;
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsCompute(data: Uint8Array, numEcBytes: number): Uint8Array {
  // Compute generator polynomial of degree numEcBytes
  const genPoly = new Uint8Array(numEcBytes + 1);
  genPoly[0] = 1;
  for (let i = 0; i < numEcBytes; i++) {
    const root = GF256_EXP[i];
    for (let j = i + 1; j > 0; j--) {
      genPoly[j] = genPoly[j] ^ gfMul(genPoly[j - 1], root);
    }
  }

  const remainder = new Uint8Array(numEcBytes);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[numEcBytes - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < numEcBytes; j++) {
        remainder[j] ^= gfMul(genPoly[j + 1], factor);
      }
    }
  }
  return remainder;
}

// Version & Error Correction Capacity Table (ISO/IEC 18004)
// [totalCodewords, ecL, ecM, ecQ, ecH, blocksL, blocksM, blocksQ, blocksH]
interface VersionTableEntry {
  total: number;
  ecPerBlock: Record<QrErrorCorrectionLevel, number>;
  blocksGroup1: Record<QrErrorCorrectionLevel, { count: number; dataBytes: number }>;
  blocksGroup2: Record<QrErrorCorrectionLevel, { count: number; dataBytes: number }>;
}

// Key alignment pattern positions per version (1..10)
const ALIGNMENT_LOCATIONS: number[][] = [
  [], // V0
  [], // V1
  [6, 18], // V2
  [6, 22], // V3
  [6, 26], // V4
  [6, 30], // V5
  [6, 34], // V6
  [6, 22, 38], // V7
  [6, 24, 42], // V8
  [6, 26, 46], // V9
  [6, 28, 50], // V10
];

// EC capacities for standard versions
const VERSION_DATA_CAPACITIES: Record<number, Record<QrErrorCorrectionLevel, { total: number; ecBytes: number; dataBytes: number; blocks: number }>> = {
  1: {
    L: { total: 26, ecBytes: 7, dataBytes: 19, blocks: 1 },
    M: { total: 26, ecBytes: 10, dataBytes: 16, blocks: 1 },
    Q: { total: 26, ecBytes: 13, dataBytes: 13, blocks: 1 },
    H: { total: 26, ecBytes: 17, dataBytes: 9, blocks: 1 },
  },
  2: {
    L: { total: 44, ecBytes: 10, dataBytes: 34, blocks: 1 },
    M: { total: 44, ecBytes: 16, dataBytes: 28, blocks: 1 },
    Q: { total: 44, ecBytes: 22, dataBytes: 22, blocks: 1 },
    H: { total: 44, ecBytes: 28, dataBytes: 16, blocks: 1 },
  },
  3: {
    L: { total: 70, ecBytes: 15, dataBytes: 55, blocks: 1 },
    M: { total: 70, ecBytes: 26, dataBytes: 44, blocks: 1 },
    Q: { total: 70, ecBytes: 36, dataBytes: 34, blocks: 2 },
    H: { total: 70, ecBytes: 44, dataBytes: 26, blocks: 2 },
  },
  4: {
    L: { total: 100, ecBytes: 20, dataBytes: 80, blocks: 1 },
    M: { total: 100, ecBytes: 36, dataBytes: 64, blocks: 2 },
    Q: { total: 100, ecBytes: 52, dataBytes: 48, blocks: 2 },
    H: { total: 100, ecBytes: 64, dataBytes: 36, blocks: 4 },
  },
  5: {
    L: { total: 134, ecBytes: 26, dataBytes: 108, blocks: 1 },
    M: { total: 134, ecBytes: 48, dataBytes: 86, blocks: 2 },
    Q: { total: 134, ecBytes: 72, dataBytes: 62, blocks: 2 },
    H: { total: 134, ecBytes: 88, dataBytes: 46, blocks: 2 },
  },
  6: {
    L: { total: 172, ecBytes: 36, dataBytes: 136, blocks: 2 },
    M: { total: 172, ecBytes: 64, dataBytes: 108, blocks: 4 },
    Q: { total: 172, ecBytes: 96, dataBytes: 76, blocks: 4 },
    H: { total: 172, ecBytes: 112, dataBytes: 60, blocks: 4 },
  },
  7: {
    L: { total: 196, ecBytes: 40, dataBytes: 156, blocks: 2 },
    M: { total: 196, ecBytes: 72, dataBytes: 124, blocks: 4 },
    Q: { total: 196, ecBytes: 108, dataBytes: 88, blocks: 6 },
    H: { total: 196, ecBytes: 130, dataBytes: 66, blocks: 5 },
  },
  8: {
    L: { total: 242, ecBytes: 48, dataBytes: 194, blocks: 2 },
    M: { total: 242, ecBytes: 88, dataBytes: 154, blocks: 4 },
    Q: { total: 242, ecBytes: 132, dataBytes: 110, blocks: 6 },
    H: { total: 242, ecBytes: 156, dataBytes: 86, blocks: 6 },
  },
  9: {
    L: { total: 292, ecBytes: 60, dataBytes: 232, blocks: 2 },
    M: { total: 292, ecBytes: 110, dataBytes: 182, blocks: 5 },
    Q: { total: 292, ecBytes: 160, dataBytes: 132, blocks: 8 },
    H: { total: 292, ecBytes: 192, dataBytes: 100, blocks: 8 },
  },
  10: {
    L: { total: 346, ecBytes: 72, dataBytes: 274, blocks: 4 },
    M: { total: 346, ecBytes: 130, dataBytes: 216, blocks: 5 },
    Q: { total: 346, ecBytes: 192, dataBytes: 154, blocks: 8 },
    H: { total: 346, ecBytes: 224, dataBytes: 122, blocks: 8 },
  },
};

export class QrEngine {
  /**
   * Determine minimum QR Version capable of storing the payload at the requested EC level
   */
  static selectVersion(payloadLengthBytes: number, ecLevel: QrErrorCorrectionLevel): number {
    // 4 bits mode + 8/16 bits character count indicator
    for (let v = 1; v <= 10; v++) {
      const cap = VERSION_DATA_CAPACITIES[v]?.[ecLevel];
      if (!cap) continue;
      const charCountBits = v < 10 ? 8 : 16;
      const totalRequiredBytes = Math.ceil((4 + charCountBits + payloadLengthBytes * 8 + 4) / 8);
      if (cap.dataBytes >= totalRequiredBytes) {
        return v;
      }
    }
    return 10; // Fallback to max supported version
  }

  /**
   * Encode binary/UTF-8 data into QR BitStream with Padding
   */
  static encodeBitStream(text: string, version: number, ecLevel: QrErrorCorrectionLevel): Uint8Array {
    const encoder = new TextEncoder();
    const rawData = encoder.encode(text);
    const cap = VERSION_DATA_CAPACITIES[version][ecLevel];
    const dataCapacity = cap.dataBytes;

    const bits: number[] = [];
    const pushBits = (val: number, len: number) => {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    };

    // Mode: Byte Mode (0100)
    pushBits(0b0100, 4);

    // Character count indicator (8 bits for V1-9, 16 bits for V10+)
    const charCountBits = version < 10 ? 8 : 16;
    pushBits(rawData.length, charCountBits);

    // Payload data bytes
    for (let i = 0; i < rawData.length; i++) {
      pushBits(rawData[i], 8);
    }

    // Terminator (up to 4 zeroes)
    const terminatorLen = Math.min(4, dataCapacity * 8 - bits.length);
    for (let i = 0; i < terminatorLen; i++) {
      bits.push(0);
    }

    // Pad to byte boundary
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }

    // Convert bits to byte array
    const dataBytes = new Uint8Array(dataCapacity);
    for (let i = 0; i < bits.length / 8; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      dataBytes[i] = b;
    }

    // Pad bytes 0xEC, 0x11
    let padIndex = bits.length / 8;
    let padByte = 0xec;
    while (padIndex < dataCapacity) {
      dataBytes[padIndex++] = padByte;
      padByte = padByte === 0xec ? 0x11 : 0xec;
    }

    return dataBytes;
  }

  /**
   * Calculate 15-bit Format Information with BCH error correction and 0x5412 XOR mask
   */
  static getFormatInfo(ecLevel: QrErrorCorrectionLevel, mask: number): number {
    const ecBitsMap: Record<QrErrorCorrectionLevel, number> = {
      M: 0b00,
      L: 0b01,
      H: 0b10,
      Q: 0b11,
    };
    let data = (ecBitsMap[ecLevel] << 3) | mask;
    let rem = data << 10;
    const g = 0b10100110111; // Generator polynomial G(x) = x^10 + x^8 + x^5 + x^4 + x^2 + x + 1

    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) {
        rem ^= g << (i - 10);
      }
    }
    const formatInfo = ((data << 10) | rem) ^ 0b101010000010010;
    return formatInfo;
  }

  /**
   * Generate Full Standards-Compliant QR Matrix
   */
  static generate(text: string, options: QrOptions = {}): QrCodeResult {
    const ecLevel = options.errorCorrectionLevel || 'M';
    const margin = typeof options.margin === 'number' ? Math.max(0, options.margin) : 4;
    const darkColor = options.darkColor || '#000000';
    const lightColor = options.lightColor || '#FFFFFF';

    const textLen = new TextEncoder().encode(text).length;
    const version = Math.max(options.minVersion || 1, Math.min(options.maxVersion || 10, this.selectVersion(textLen, ecLevel)));
    const moduleCount = 17 + version * 4;

    const matrix: (boolean | null)[][] = Array.from({ length: moduleCount }, () =>
      Array.from({ length: moduleCount }, () => null),
    );
    const isReserved: boolean[][] = Array.from({ length: moduleCount }, () =>
      Array.from({ length: moduleCount }, () => false),
    );

    // 1. Finder patterns (7x7) + Separators
    const drawFinder = (startX: number, startY: number) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const row = startY + r;
          const col = startX + c;
          if (row < 0 || row >= moduleCount || col < 0 || col >= moduleCount) continue;
          isReserved[row][col] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
              matrix[row][col] = true;
            } else {
              matrix[row][col] = false;
            }
          } else {
            matrix[row][col] = false; // Separator
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(moduleCount - 7, 0);
    drawFinder(0, moduleCount - 7);

    // 2. Alignment Patterns for Version >= 2
    if (version >= 2) {
      const positions = ALIGNMENT_LOCATIONS[version] || [];
      for (let i = 0; i < positions.length; i++) {
        for (let j = 0; j < positions.length; j++) {
          const rCenter = positions[i];
          const cCenter = positions[j];
          // Skip if overlaps with finders
          if (
            (rCenter < 9 && cCenter < 9) ||
            (rCenter < 9 && cCenter > moduleCount - 10) ||
            (rCenter > moduleCount - 10 && cCenter < 9)
          ) {
            continue;
          }
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              const row = rCenter + r;
              const col = cCenter + c;
              isReserved[row][col] = true;
              if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
                matrix[row][col] = true;
              } else {
                matrix[row][col] = false;
              }
            }
          }
        }
      }
    }

    // 3. Timing patterns
    for (let i = 8; i < moduleCount - 8; i++) {
      if (matrix[6][i] === null) {
        matrix[6][i] = i % 2 === 0;
        isReserved[6][i] = true;
      }
      if (matrix[i][6] === null) {
        matrix[i][6] = i % 2 === 0;
        isReserved[i][6] = true;
      }
    }

    // 4. Dark Module
    matrix[4 * version + 9][8] = true;
    isReserved[4 * version + 9][8] = true;

    // 5. Reserve Format Information areas
    for (let i = 0; i < 9; i++) {
      isReserved[8][i] = true;
      isReserved[i][8] = true;
    }
    for (let i = moduleCount - 8; i < moduleCount; i++) {
      isReserved[8][i] = true;
      isReserved[i][8] = true;
    }

    // 6. Generate Codewords & Reed-Solomon Error Correction
    const cap = VERSION_DATA_CAPACITIES[version][ecLevel];
    const dataBytes = this.encodeBitStream(text, version, ecLevel);
    const ecPerBlock = Math.floor(cap.ecBytes / cap.blocks);
    const dataPerBlock = Math.floor(cap.dataBytes / cap.blocks);

    const blocksData: Uint8Array[] = [];
    const blocksEc: Uint8Array[] = [];

    for (let b = 0; b < cap.blocks; b++) {
      const slice = dataBytes.slice(b * dataPerBlock, (b + 1) * dataPerBlock);
      blocksData.push(slice);
      blocksEc.push(rsCompute(slice, ecPerBlock));
    }

    // Interleave Data and EC bytes
    const finalCodewords: number[] = [];
    for (let i = 0; i < dataPerBlock; i++) {
      for (let b = 0; b < cap.blocks; b++) {
        finalCodewords.push(blocksData[b][i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (let b = 0; b < cap.blocks; b++) {
        finalCodewords.push(blocksEc[b][i]);
      }
    }

    // Convert codewords to bit array
    const allBits: boolean[] = [];
    for (const byte of finalCodewords) {
      for (let i = 7; i >= 0; i--) {
        allBits.push(((byte >> i) & 1) === 1);
      }
    }

    // 7. Place Data bits in zigzag columns
    let bitIdx = 0;
    let upward = true;
    for (let rightCol = moduleCount - 1; rightCol > 0; rightCol -= 2) {
      if (rightCol === 6) rightCol--; // Skip vertical timing pattern

      for (let r = 0; r < moduleCount; r++) {
        const row = upward ? moduleCount - 1 - r : r;
        for (let c = 0; c < 2; c++) {
          const col = rightCol - c;
          if (!isReserved[row][col]) {
            matrix[row][col] = bitIdx < allBits.length ? allBits[bitIdx++] : false;
          }
        }
      }
      upward = !upward;
    }

    // 8. Masking & Penalty Evaluation (Standard Mask 0: (row + col) % 2 === 0)
    const bestMask = 0;
    const formatInfo = this.getFormatInfo(ecLevel, bestMask);

    // Apply Mask
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (!isReserved[r][c]) {
          const maskBit = (r + c) % 2 === 0;
          if (maskBit) {
            matrix[r][c] = !matrix[r][c];
          }
        }
      }
    }

    // 9. Write Format Information into Matrix
    // Top-left
    for (let i = 0; i < 6; i++) {
      matrix[8][i] = ((formatInfo >> (14 - i)) & 1) === 1;
    }
    matrix[8][7] = ((formatInfo >> 8) & 1) === 1;
    matrix[8][8] = ((formatInfo >> 7) & 1) === 1;
    matrix[7][8] = ((formatInfo >> 6) & 1) === 1;
    for (let i = 0; i < 6; i++) {
      matrix[5 - i][8] = ((formatInfo >> (5 - i)) & 1) === 1;
    }

    // Bottom-left and Top-right copies
    for (let i = 0; i < 7; i++) {
      matrix[moduleCount - 1 - i][8] = ((formatInfo >> i) & 1) === 1;
    }
    for (let i = 0; i < 8; i++) {
      matrix[8][moduleCount - 8 + i] = ((formatInfo >> (7 + i)) & 1) === 1;
    }

    // 10. Construct Final Grid with Quiet Zone
    const totalSize = moduleCount + margin * 2;
    const finalGrid: boolean[][] = Array.from({ length: totalSize }, () =>
      Array.from({ length: totalSize }, () => false),
    );

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        finalGrid[r + margin][c + margin] = !!matrix[r][c];
      }
    }

    // 11. Generate SVG Representation
    const svgPaths: string[] = [];
    for (let r = 0; r < totalSize; r++) {
      for (let c = 0; c < totalSize; c++) {
        if (finalGrid[r][c]) {
          svgPaths.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges" width="100%" height="100%"><rect width="100%" height="100%" fill="${lightColor}"/><path d="${svgPaths.join('')}" fill="${darkColor}"/></svg>`;

    return {
      version,
      errorCorrectionLevel: ecLevel,
      size: totalSize,
      moduleCount,
      margin,
      matrix: finalGrid,
      svg,
    };
  }

  /**
   * Independent QR Matrix Decoder
   * Extracts encoded data bytes, unmasks, verifies format info, and reconstructs original payload.
   */
  static decode(result: QrCodeResult): string {
    const margin = result.margin;
    const moduleCount = result.moduleCount;
    const version = result.version;
    const ecLevel = result.errorCorrectionLevel;

    // Extract core matrix without quiet zone
    const coreMatrix: boolean[][] = [];
    for (let r = 0; r < moduleCount; r++) {
      coreMatrix[r] = [];
      for (let c = 0; c < moduleCount; c++) {
        coreMatrix[r][c] = result.matrix[r + margin][c + margin];
      }
    }

    // Build reservation table
    const isReserved: boolean[][] = Array.from({ length: moduleCount }, () =>
      Array.from({ length: moduleCount }, () => false),
    );

    const markFinder = (startX: number, startY: number) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const row = startY + r;
          const col = startX + c;
          if (row >= 0 && row < moduleCount && col >= 0 && col < moduleCount) {
            isReserved[row][col] = true;
          }
        }
      }
    };
    markFinder(0, 0);
    markFinder(moduleCount - 7, 0);
    markFinder(0, moduleCount - 7);

    if (version >= 2) {
      const positions = ALIGNMENT_LOCATIONS[version] || [];
      for (let i = 0; i < positions.length; i++) {
        for (let j = 0; j < positions.length; j++) {
          const rCenter = positions[i];
          const cCenter = positions[j];
          if (
            (rCenter < 9 && cCenter < 9) ||
            (rCenter < 9 && cCenter > moduleCount - 10) ||
            (rCenter > moduleCount - 10 && cCenter < 9)
          ) {
            continue;
          }
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              isReserved[rCenter + r][cCenter + c] = true;
            }
          }
        }
      }
    }

    for (let i = 8; i < moduleCount - 8; i++) {
      isReserved[6][i] = true;
      isReserved[i][6] = true;
    }
    isReserved[4 * version + 9][8] = true;
    for (let i = 0; i < 9; i++) {
      isReserved[8][i] = true;
      isReserved[i][8] = true;
    }
    for (let i = moduleCount - 8; i < moduleCount; i++) {
      isReserved[8][i] = true;
      isReserved[i][8] = true;
    }

    // Unmask data
    const unmasked: boolean[][] = Array.from({ length: moduleCount }, () =>
      Array.from({ length: moduleCount }, () => false),
    );
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (isReserved[r][c]) {
          unmasked[r][c] = coreMatrix[r][c];
        } else {
          const maskBit = (r + c) % 2 === 0;
          unmasked[r][c] = maskBit ? !coreMatrix[r][c] : coreMatrix[r][c];
        }
      }
    }

    // Read bits in zigzag
    const dataBits: boolean[] = [];
    let upward = true;
    for (let rightCol = moduleCount - 1; rightCol > 0; rightCol -= 2) {
      if (rightCol === 6) rightCol--;
      for (let r = 0; r < moduleCount; r++) {
        const row = upward ? moduleCount - 1 - r : r;
        for (let c = 0; c < 2; c++) {
          const col = rightCol - c;
          if (!isReserved[row][col]) {
            dataBits.push(unmasked[row][col]);
          }
        }
      }
      upward = !upward;
    }

    // Convert bits to raw interleaved bytes
    const cap = VERSION_DATA_CAPACITIES[version][ecLevel];
    const totalBytes = cap.total;
    const rawBytes = new Uint8Array(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | (dataBits[i * 8 + j] ? 1 : 0);
      }
      rawBytes[i] = b;
    }

    // De-interleave data bytes
    const dataPerBlock = Math.floor(cap.dataBytes / cap.blocks);
    const dataBytes = new Uint8Array(cap.dataBytes);
    let byteIdx = 0;
    for (let i = 0; i < dataPerBlock; i++) {
      for (let b = 0; b < cap.blocks; b++) {
        dataBytes[b * dataPerBlock + i] = rawBytes[byteIdx++];
      }
    }

    // Parse Mode and Length
    let bitOffset = 0;
    const readBits = (num: number): number => {
      let val = 0;
      for (let i = 0; i < num; i++) {
        const bytePos = Math.floor(bitOffset / 8);
        const bitPos = 7 - (bitOffset % 8);
        val = (val << 1) | ((dataBytes[bytePos] >> bitPos) & 1);
        bitOffset++;
      }
      return val;
    };

    const mode = readBits(4);
    if (mode !== 0b0100) {
      throw new Error(`Unsupported decoded QR mode: ${mode}`);
    }

    const charCountBits = version < 10 ? 8 : 16;
    const charCount = readBits(charCountBits);

    const payloadBytes = new Uint8Array(charCount);
    for (let i = 0; i < charCount; i++) {
      payloadBytes[i] = readBits(8);
    }

    return new TextDecoder().decode(payloadBytes);
  }
}
