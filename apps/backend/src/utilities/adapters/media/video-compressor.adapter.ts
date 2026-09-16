import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  VideoCompressorInput,
  VideoCompressorOutput,
} from '@ad-utility/shared';
import { runFfmpegSafe } from './ffmpeg-runner';
import { parseBase64Payload, bufferToDataUrl, sanitizeFilename } from '../utils/buffer-utils';

export class VideoCompressorAdapter implements UtilityAdapter<VideoCompressorInput, VideoCompressorOutput> {
  readonly slug = 'video-compressor';
  readonly name = 'Video Compressor';
  readonly description = 'Compress MP4 and WebM videos to reduce file size with balanced visual quality';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 60000,
    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  };

  validateInput(input: unknown): VideoCompressorInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, targetQuality, crf, maxResolution, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    return {
      fileData,
      targetQuality: targetQuality === 'high' || targetQuality === 'low' ? targetQuality : 'medium',
      crf: typeof crf === 'number' && crf >= 18 && crf <= 36 ? Math.round(crf) : undefined,
      maxResolution: maxResolution === '480p' || maxResolution === '720p' || maxResolution === '1080p' ? maxResolution : 'original',
      filename: sanitizeFilename(filename, 'video', 'mp4'),
    };
  }

  async execute(input: VideoCompressorInput, _context: UtilityExecutionContext): Promise<VideoCompressorOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`Video file size exceeds the 200MB limit`);
    }

    let crf = input.crf;
    if (!crf) {
      if (input.targetQuality === 'high') crf = 24;
      else if (input.targetQuality === 'low') crf = 32;
      else crf = 28;
    }

    const scaleFilter =
      input.maxResolution === '480p'
        ? 'scale=-2:480'
        : input.maxResolution === '720p'
          ? 'scale=-2:720'
          : input.maxResolution === '1080p'
            ? 'scale=-2:1080'
            : null;

    const { outputBuffer } = await runFfmpegSafe({
      inputBuffer: buffer,
      inputExtension: 'mp4',
      outputExtension: 'mp4',
      timeoutMs: 30000,
      args: (inPath, outPath) => {
        const args = ['-i', inPath, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'fast'];
        if (scaleFilter) {
          args.push('-vf', scaleFilter);
        }
        args.push('-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath);
        return args;
      },
    });

    const dataUrl = bufferToDataUrl(outputBuffer, 'video/mp4');
    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'video';
    const outFilename = `${baseName}_compressed.mp4`;

    const originalSize = buffer.length;
    const compressedSize = outputBuffer.length;
    const savingsPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 1000) / 10);

    return {
      dataUrl,
      filename: outFilename,
      originalSizeBytes: originalSize,
      compressedSizeBytes: compressedSize,
      savingsPercent,
    };
  }
}
