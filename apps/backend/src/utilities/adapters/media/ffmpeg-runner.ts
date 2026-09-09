import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface FfmpegRunOptions {
  inputBuffer: Buffer;
  inputExtension: string;
  outputExtension: string;
  args: (inputPath: string, outputPath: string) => string[];
  timeoutMs?: number;
  maxOutputSizeBytes?: number;
}

export interface FfmpegRunResult {
  outputBuffer: Buffer;
  outputExtension: string;
}

/**
 * Execute FFmpeg safely with spawn (no shell), strict timeouts, and guaranteed temp file cleanup.
 */
export async function runFfmpegSafe(options: FfmpegRunOptions): Promise<FfmpegRunResult> {
  const timeoutMs = options.timeoutMs || 30000;
  const tempId = crypto.randomBytes(8).toString('hex');
  const tempDir = os.tmpdir();

  const inputPath = path.join(tempDir, `ff_in_${tempId}.${options.inputExtension}`);
  const outputPath = path.join(tempDir, `ff_out_${tempId}.${options.outputExtension}`);

  try {
    await fs.promises.writeFile(inputPath, options.inputBuffer);

    const ffmpegArgs = options.args(inputPath, outputPath);

    await new Promise<void>((resolve, reject) => {
      let isTimedOut = false;
      const proc = spawn('ffmpeg', ['-y', ...ffmpegArgs], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          proc.kill('SIGKILL');
        } catch {}
        reject(new Error('Media processing exceeded the maximum execution timeout.'));
      }, timeoutMs);

      let stderrData = '';
      proc.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      proc.on('error', (err: any) => {
        clearTimeout(timer);
        if (err.code === 'ENOENT') {
          reject(new Error('FFmpeg runtime is not available in the current environment.'));
        } else {
          reject(new Error(`Failed to start media processing: ${err.message}`));
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (isTimedOut) return;

        if (code === 0) {
          resolve();
        } else {
          // Sanitize stderr to avoid exposing internal filesystem paths
          const safeMessage = stderrData.split('\n').filter((l) => !l.includes('/tmp') && !l.includes('C:\\')).slice(-3).join(' ') || 'Conversion failed';
          reject(new Error(`Media conversion failed (${code}): ${safeMessage.trim()}`));
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Media processing completed but no output was generated.');
    }

    const outputBuffer = await fs.promises.readFile(outputPath);
    if (outputBuffer.length === 0) {
      throw new Error('Generated output file is empty.');
    }

    if (options.maxOutputSizeBytes && outputBuffer.length > options.maxOutputSizeBytes) {
      throw new Error(`Output file exceeds size limit of ${Math.round(options.maxOutputSizeBytes / 1024 / 1024)}MB`);
    }

    return {
      outputBuffer,
      outputExtension: options.outputExtension,
    };
  } finally {
    // Guaranteed cleanup of temporary files
    try {
      if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
    } catch {}
    try {
      if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
    } catch {}
  }
}
