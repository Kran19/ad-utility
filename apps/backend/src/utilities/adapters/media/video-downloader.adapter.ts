import {
  UtilityAdapter,
  UtilityExecutionContext,
  VideoDownloaderInput,
  VideoDownloaderOutput,
  VideoDownloaderErrorCode,
} from '@ad-utility/shared';
import { VideoUrlDownloadService } from '../../services/video-downloader/video-url-download.service';

export class VideoDownloaderAdapter implements UtilityAdapter<VideoDownloaderInput, VideoDownloaderOutput> {
  public readonly slug = 'video-downloader';
  public readonly name = 'Video Downloader';
  public readonly description = 'Download videos directly and securely from verified HTTP/HTTPS media URLs with instant format validation';
  public readonly version = '1.0.0';
  public readonly mode = 'SERVER' as const;
  public readonly resourceLimits = {
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxExecutionTimeMs: 30000,
    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo'],
  };

  private readonly service = new VideoUrlDownloadService();

  public validateInput(rawInput: any): VideoDownloaderInput {
    if (!rawInput || typeof rawInput !== 'object') {
      const err: any = new Error('Input payload must be an object with a "url" property.');
      err.code = VideoDownloaderErrorCode.INVALID_URL;
      throw err;
    }

    const url = rawInput.url;
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      const err: any = new Error('Video URL is required.');
      err.code = VideoDownloaderErrorCode.INVALID_URL;
      throw err;
    }

    return {
      url: url.trim(),
    };
  }

  public async execute(
    input: VideoDownloaderInput,
    context?: UtilityExecutionContext,
  ): Promise<VideoDownloaderOutput> {
    return this.service.processUrlDownload(input);
  }
}
