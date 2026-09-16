import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  VideoToGifInput,
  VideoToGifOutput,
} from '@ad-utility/shared';
import { runFfmpegSafe } from './ffmpeg-runner';
import { parseBase64Payload, bufferToDataUrl, sanitizeFilename } from '../utils/buffer-utils';

export class VideoToGifAdapter implements UtilityAdapter<VideoToGifInput, VideoToGifOutput> {
  readonly slug = 'video-to-gif';
  readonly name = 'Video to GIF';
  readonly description = 'Convert short video clips into high-quality, animated GIF files';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 60000,
    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  };

  validateInput(input: unknown): VideoToGifInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData"');
    }
    const { fileData, startTimeSec, durationSec, fps, width, filename } = input as any;
    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    return {
      fileData,
      startTimeSec: typeof startTimeSec === 'number' && startTimeSec >= 0 ? startTimeSec : 0,
      durationSec: typeof durationSec === 'number' && durationSec > 0 && durationSec <= 30 ? durationSec : 5,
      fps: typeof fps === 'number' && fps >= 5 && fps <= 24 ? Math.round(fps) : 10,
      width: typeof width === 'number' && width >= 120 && width <= 800 ? Math.round(width) : 480,
      filename: sanitizeFilename(filename, 'animation', 'gif'),
    };
  }

  async execute(input: VideoToGifInput, _context: UtilityExecutionContext): Promise<VideoToGifOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`Video file size exceeds the 200MB limit`);
    }

    const start = input.startTimeSec || 0;
    const duration = input.durationSec || 5;
    const fps = input.fps || 10;
    const w = input.width || 480;

    const { outputBuffer } = await runFfmpegSafe({
      inputBuffer: buffer,
      inputExtension: 'mp4',
      outputExtension: 'gif',
      timeoutMs: 25000,
      args: (inPath, outPath) => [
        '-ss',
        String(start),
        '-t',
        String(duration),
        '-i',
        inPath,
        '-vf',
        `fps=${fps},scale=${w}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
        outPath,
      ],
    });

    const dataUrl = bufferToDataUrl(outputBuffer, 'image/gif');
    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'animation';
    const outFilename = `${baseName}.gif`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: outputBuffer.length,
    };
  }
}
