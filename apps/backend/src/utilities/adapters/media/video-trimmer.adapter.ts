import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  VideoTrimmerInput,
  VideoTrimmerOutput,
} from '@ad-utility/shared';
import { runFfmpegSafe } from './ffmpeg-runner';
import { parseBase64Payload, bufferToDataUrl, sanitizeFilename } from '../utils/buffer-utils';

export class VideoTrimmerAdapter implements UtilityAdapter<VideoTrimmerInput, VideoTrimmerOutput> {
  readonly slug = 'video-trimmer';
  readonly name = 'Video Trimmer';
  readonly description = 'Cut and trim video segments with millisecond precision without quality loss';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 60000,
    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  };

  validateInput(input: unknown): VideoTrimmerInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData", "startTimeSec", and "endTimeSec"');
    }
    const { fileData, startTimeSec, endTimeSec, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    const start = typeof startTimeSec === 'number' && startTimeSec >= 0 ? startTimeSec : 0;
    const end = typeof endTimeSec === 'number' && endTimeSec > start ? endTimeSec : start + 10;

    if (end - start > 180) {
      throw new Error('Maximum supported trim duration is 3 minutes (180 seconds)');
    }

    return {
      fileData,
      startTimeSec: start,
      endTimeSec: end,
      filename: sanitizeFilename(filename, 'trimmed_video', 'mp4'),
    };
  }

  async execute(input: VideoTrimmerInput, _context: UtilityExecutionContext): Promise<VideoTrimmerOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`Video file size exceeds the 200MB limit`);
    }

    const duration = input.endTimeSec - input.startTimeSec;

    const { outputBuffer } = await runFfmpegSafe({
      inputBuffer: buffer,
      inputExtension: 'mp4',
      outputExtension: 'mp4',
      timeoutMs: 25000,
      args: (inPath, outPath) => [
        '-ss',
        String(input.startTimeSec),
        '-i',
        inPath,
        '-t',
        String(duration),
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outPath,
      ],
    });

    const dataUrl = bufferToDataUrl(outputBuffer, 'video/mp4');
    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'trimmed_video';
    const outFilename = `${baseName}_cut.mp4`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: outputBuffer.length,
      durationSec: duration,
    };
  }
}
