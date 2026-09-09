import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  Mp4ToMp3Input,
  Mp4ToMp3Output,
} from '@ad-utility/shared';
import { runFfmpegSafe } from './ffmpeg-runner';
import { parseBase64Payload, bufferToDataUrl, sanitizeFilename } from '../utils/buffer-utils';

export class Mp4ToMp3Adapter implements UtilityAdapter<Mp4ToMp3Input, Mp4ToMp3Output> {
  readonly slug = 'mp4-to-mp3';
  readonly name = 'MP4 to MP3';
  readonly description = 'Extract high-fidelity audio tracks from MP4 video files into MP3 format';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    maxExecutionTimeMs: 25000,
    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  };

  validateInput(input: unknown): Mp4ToMp3Input {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, bitrate, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    return {
      fileData,
      bitrate: bitrate === '128k' || bitrate === '192k' || bitrate === '256k' || bitrate === '320k' ? bitrate : '192k',
      filename: sanitizeFilename(filename, 'audio', 'mp3'),
    };
  }

  async execute(input: Mp4ToMp3Input, _context: UtilityExecutionContext): Promise<Mp4ToMp3Output> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 52428800;
    if (buffer.length > maxBytes) {
      throw new Error(`Video file size exceeds the 50MB limit`);
    }

    const { outputBuffer } = await runFfmpegSafe({
      inputBuffer: buffer,
      inputExtension: 'mp4',
      outputExtension: 'mp3',
      timeoutMs: 25000,
      args: (inPath, outPath) => [
        '-i',
        inPath,
        '-vn',
        '-c:a',
        'libmp3lame',
        '-b:a',
        input.bitrate || '192k',
        outPath,
      ],
    });

    const dataUrl = bufferToDataUrl(outputBuffer, 'audio/mp3');
    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'audio';
    const outFilename = `${baseName}.mp3`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: outputBuffer.length,
    };
  }
}
