import {
  UtilityAdapter,
  UtilityExecutionContext,
  UtilityResourceLimits,
  AudioCutterInput,
  AudioCutterOutput,
} from '@ad-utility/shared';
import { runFfmpegSafe } from './ffmpeg-runner';
import { parseBase64Payload, bufferToDataUrl, sanitizeFilename } from '../utils/buffer-utils';

export class AudioCutterAdapter implements UtilityAdapter<AudioCutterInput, AudioCutterOutput> {
  readonly slug = 'audio-cutter';
  readonly name = 'Audio Cutter';
  readonly description = 'Cut and trim MP3, WAV, and audio tracks with millisecond precision';
  readonly version = '1.0.0';
  readonly mode = 'SERVER';
  readonly resourceLimits: UtilityResourceLimits = {
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxExecutionTimeMs: 40000,
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  };

  validateInput(input: unknown): AudioCutterInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object with "fileData", "startTimeSec", and "endTimeSec"');
    }
    const { fileData, startTimeSec, endTimeSec, filename } = input as any;

    if (typeof fileData !== 'string' || fileData.trim().length === 0) {
      throw new Error('Property "fileData" is required');
    }

    const start = typeof startTimeSec === 'number' && startTimeSec >= 0 ? startTimeSec : 0;
    const end = typeof endTimeSec === 'number' && endTimeSec > start ? endTimeSec : start + 30;

    if (end - start > 600) {
      throw new Error('Maximum supported audio cut duration is 10 minutes (600 seconds)');
    }

    return {
      fileData,
      startTimeSec: start,
      endTimeSec: end,
      filename: sanitizeFilename(filename, 'audio_clip', 'mp3'),
    };
  }

  async execute(input: AudioCutterInput, _context: UtilityExecutionContext): Promise<AudioCutterOutput> {
    const { buffer } = parseBase64Payload(input.fileData);

    const maxBytes = this.resourceLimits?.maxFileSizeBytes || 209715200;
    if (buffer.length > maxBytes) {
      throw new Error(`Audio file size exceeds the 200MB limit`);
    }

    const duration = input.endTimeSec - input.startTimeSec;

    const { outputBuffer } = await runFfmpegSafe({
      inputBuffer: buffer,
      inputExtension: 'mp3',
      outputExtension: 'mp3',
      timeoutMs: 20000,
      args: (inPath, outPath) => [
        '-ss',
        String(input.startTimeSec),
        '-i',
        inPath,
        '-t',
        String(duration),
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        outPath,
      ],
    });

    const dataUrl = bufferToDataUrl(outputBuffer, 'audio/mp3');
    const baseName = input.filename ? input.filename.replace(/\.[^/.]+$/, '') : 'audio_clip';
    const outFilename = `${baseName}_cut.mp3`;

    return {
      dataUrl,
      filename: outFilename,
      sizeBytes: outputBuffer.length,
      durationSec: duration,
    };
  }
}
