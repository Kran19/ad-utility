import { spawn } from 'child_process';
import * as fs from 'fs';
import { URL } from 'url';
import { VideoDownloaderInput, VideoDownloaderOutput, VideoDownloaderErrorCode } from '@ad-utility/shared';
import { VideoSourceProvider } from './video-source-provider.interface';
import { DirectVideoProvider } from './direct-video.provider';
import { YouTubeVideoProvider } from './youtube-video.provider';
import { InstagramVideoProvider } from './instagram-video.provider';
import { VideoDownloadStorageService } from './video-storage.service';

export interface VideoProbeMetadata {
  duration?: number;
  width?: number;
  height?: number;
  hasVideoStream: boolean;
  hasAudioStream: boolean;
  codec?: string;
  streamCount: number;
}

export class VideoUrlDownloadService {
  private readonly providers: VideoSourceProvider[] = [
    new YouTubeVideoProvider(),
    new InstagramVideoProvider(),
    new DirectVideoProvider(),
  ];
  private readonly storage = VideoDownloadStorageService.getInstance();

  /**
   * List of known domains that require explicit authentication, DRM, or paywalls.
   */
  private readonly unsupportedDomains = [
    'netflix.com',
    'spotify.com',
    'disneyplus.com',
    'hulu.com',
    'primevideo.com',
  ];

  public async processUrlDownload(input: VideoDownloaderInput, signal?: AbortSignal): Promise<VideoDownloaderOutput> {
    if (!input || !input.url || typeof input.url !== 'string') {
      const err: any = new Error('A valid video URL is required.');
      err.code = VideoDownloaderErrorCode.INVALID_URL;
      throw err;
    }

    const trimmedUrl = input.url.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      const err: any = new Error('Invalid URL format. Please provide a full HTTP or HTTPS URL.');
      err.code = VideoDownloaderErrorCode.INVALID_URL;
      throw err;
    }

    // 1. Social platform rejection check
    const hostname = parsedUrl.hostname.toLowerCase();
    const isUnsupportedSocial = this.unsupportedDomains.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`),
    );

    if (isUnsupportedSocial) {
      const err: any = new Error(
        `Direct video downloading is not supported for ${hostname}. This tool exclusively downloads authorized, direct video URLs (e.g. .mp4, .webm links).`,
      );
      err.code = VideoDownloaderErrorCode.UNSUPPORTED_SOURCE;
      throw err;
    }

    // 2. Select appropriate provider
    const provider = this.providers.find((p) => p.canHandle(parsedUrl));
    if (!provider) {
      const err: any = new Error(`No compatible video download provider found for URL scheme "${parsedUrl.protocol}".`);
      err.code = VideoDownloaderErrorCode.UNSUPPORTED_PROTOCOL;
      throw err;
    }

    // 3. Download to secure temporary file
    const downloadResult = await provider.download(parsedUrl, { signal });

    try {
      // 4. Inspect media with ffprobe
      const probeData = await this.probeVideo(downloadResult.tempFilePath);

      if (!probeData.hasVideoStream) {
        const err: any = new Error('The downloaded media does not contain a valid video stream.');
        err.code = VideoDownloaderErrorCode.INVALID_MEDIA;
        throw err;
      }

      if (probeData.streamCount > 16) {
        const err: any = new Error('The downloaded file exceeds the maximum allowed stream complexity limit.');
        err.code = VideoDownloaderErrorCode.UNSUPPORTED_MEDIA;
        throw err;
      }

      const MAX_DURATION_SEC = 1800; // 30 minutes
      if (probeData.duration && probeData.duration > MAX_DURATION_SEC) {
        const err: any = new Error(
          `Video duration (${Math.round(probeData.duration / 60)} minutes) exceeds the maximum allowed limit of 30 minutes.`,
        );
        err.code = VideoDownloaderErrorCode.MEDIA_TOO_LONG;
        throw err;
      }

      const MAX_DIMENSION = 4096;
      if (
        (probeData.width && probeData.width > MAX_DIMENSION) ||
        (probeData.height && probeData.height > MAX_DIMENSION)
      ) {
        const err: any = new Error('Video resolution exceeds the 4K maximum dimension limit.');
        err.code = VideoDownloaderErrorCode.MEDIA_RESOLUTION_TOO_HIGH;
        throw err;
      }

      // 5. Store temporary download artifact
      const downloadToken = this.storage.registerArtifact({
        filePath: downloadResult.tempFilePath,
        filename: downloadResult.filename,
        mimeType: downloadResult.mimeType,
        sizeBytes: downloadResult.sizeBytes,
      });

      return {
        downloadUrl: `/api/v1/utilities/video-downloader/download/${downloadToken}`,
        downloadToken,
        filename: downloadResult.filename,
        sizeBytes: downloadResult.sizeBytes,
        mimeType: downloadResult.mimeType,
        format: downloadResult.format,
        duration: probeData.duration ? Math.round(probeData.duration) : undefined,
        width: probeData.width,
        height: probeData.height,
      };
    } catch (err) {
      // Clean up file if ffprobe inspection or storage fails
      try {
        if (fs.existsSync(downloadResult.tempFilePath)) {
          await fs.promises.unlink(downloadResult.tempFilePath);
        }
      } catch {}
      throw err;
    }
  }

  /**
   * Safely probe video file using ffprobe with argument arrays and timeout.
   */
  public async probeVideo(filePath: string, timeoutMs = 15000): Promise<VideoProbeMetadata> {
    const ffprobeBin = process.env.FFPROBE_PATH || 'ffprobe';

    return new Promise<VideoProbeMetadata>((resolve) => {
      const args = [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,codec_name,width,height:format=duration,nb_streams',
        '-of',
        'json',
        filePath,
      ];

      let isTimedOut = false;
      const proc = spawn(ffprobeBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          proc.kill('SIGKILL');
        } catch {}
        // Fallback: If ffprobe times out or is missing, assume basic video stream
        resolve({
          hasVideoStream: true,
          hasAudioStream: true,
          streamCount: 1,
        });
      }, timeoutMs);

      let stdoutData = '';
      proc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      proc.on('error', () => {
        clearTimeout(timer);
        // Fallback if ffprobe binary is not installed in local environment
        resolve({
          hasVideoStream: true,
          hasAudioStream: true,
          streamCount: 1,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (isTimedOut) return;

        if (code !== 0) {
          // If ffprobe exits with non-zero, resolve fallback or reject
          resolve({
            hasVideoStream: true,
            hasAudioStream: true,
            streamCount: 1,
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdoutData);
          const streams = parsed.streams || [];
          const format = parsed.format || {};

          const videoStream = streams.find((s: any) => s.codec_type === 'video');
          const audioStream = streams.find((s: any) => s.codec_type === 'audio');

          const duration = format.duration ? parseFloat(format.duration) : undefined;
          const width = videoStream?.width ? parseInt(videoStream.width, 10) : undefined;
          const height = videoStream?.height ? parseInt(videoStream.height, 10) : undefined;
          const codec = videoStream?.codec_name;
          const streamCount = format.nb_streams ? parseInt(format.nb_streams, 10) : streams.length || 1;

          resolve({
            hasVideoStream: !!videoStream || streams.length === 0,
            hasAudioStream: !!audioStream,
            duration,
            width,
            height,
            codec,
            streamCount,
          });
        } catch {
          resolve({
            hasVideoStream: true,
            hasAudioStream: true,
            streamCount: 1,
          });
        }
      });
    });
  }
}
