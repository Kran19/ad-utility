import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { URL } from 'url';
import ytdl from '@distube/ytdl-core';
import { VideoSourceProvider, VideoDownloadOptions, VideoDownloadResult } from './video-source-provider.interface';
import { VideoDownloaderErrorCode } from '@ad-utility/shared';
import { sanitizeFilename } from '../../adapters/utils/buffer-utils';

export class YouTubeVideoProvider implements VideoSourceProvider {
  public readonly name = 'YouTubeVideoProvider';

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be'
    );
  }

  public async download(url: URL, options: VideoDownloadOptions = {}): Promise<VideoDownloadResult> {
    const rawUrl = url.toString();
    const maxSizeBytes = options.maxSizeBytes || 50 * 1024 * 1024; // 50MB
    const timeoutMs = options.timeoutMs || 35000;

    const tempId = crypto.randomBytes(12).toString('hex');
    const tempFilePath = path.join(os.tmpdir(), `vdl_yt_${Date.now()}_${tempId}.mp4`);

    try {
      // 1. Validate YouTube URL
      if (!ytdl.validateURL(rawUrl)) {
        const err: any = new Error('The provided URL is not a valid YouTube video link.');
        err.code = VideoDownloaderErrorCode.INVALID_URL;
        throw err;
      }

      // 2. Fetch video metadata
      let info: ytdl.videoInfo;
      try {
        info = await ytdl.getInfo(rawUrl, {
          requestOptions: {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          },
        });
      } catch (e: any) {
        const err: any = new Error(
          e.message?.includes('private') || e.message?.includes('Sign in')
            ? 'This YouTube video is private, restricted, or requires login.'
            : `Unable to retrieve YouTube video details: ${e.message}`,
        );
        err.code = VideoDownloaderErrorCode.REMOTE_NOT_FOUND;
        throw err;
      }

      const videoDetails = info.videoDetails;
      const title = videoDetails.title || 'youtube_video';
      const durationSec = parseInt(videoDetails.lengthSeconds || '0', 10);

      if (durationSec > 1800) {
        const err: any = new Error(
          `Video duration (${Math.round(durationSec / 60)} minutes) exceeds the maximum allowed limit of 30 minutes.`,
        );
        err.code = VideoDownloaderErrorCode.MEDIA_TOO_LONG;
        throw err;
      }

      // 3. Select best combined format (has both video and audio) or best progressive MP4
      const formats = info.formats || [];
      const combinedFormats = formats.filter(
        (f) => f.hasVideo && f.hasAudio && (f.container === 'mp4' || f.mimeType?.includes('video/mp4')),
      );

      // Pick highest quality combined format
      let chosenFormat: ytdl.videoFormat | undefined = combinedFormats.sort(
        (a, b) => (b.bitrate || 0) - (a.bitrate || 0),
      )[0];

      if (!chosenFormat) {
        // Fallback to any combined format
        chosenFormat = formats.find((f) => f.hasVideo && f.hasAudio) || formats.find((f) => f.hasVideo);
      }

      if (!chosenFormat) {
        const err: any = new Error('No compatible video stream found for this YouTube link.');
        err.code = VideoDownloaderErrorCode.UNSUPPORTED_MEDIA;
        throw err;
      }

      // 4. Stream to temporary file with byte ceiling & timeout
      const fileWriteStream = fs.createWriteStream(tempFilePath);
      let downloadedBytes = 0;

      await new Promise<void>((resolve, reject) => {
        let isTimedOut = false;
        const timer = setTimeout(() => {
          isTimedOut = true;
          fileWriteStream.destroy();
          const err: any = new Error(`YouTube download timed out after ${Math.round(timeoutMs / 1000)}s.`);
          err.code = VideoDownloaderErrorCode.REMOTE_TIMEOUT;
          reject(err);
        }, timeoutMs);

        const stream = ytdl.downloadFromInfo(info, {
          format: chosenFormat,
          requestOptions: {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          },
        });

        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            stream.destroy();
            fileWriteStream.destroy();
            const abortErr: any = new Error('Download aborted by client.');
            abortErr.code = 'ABORTED';
            reject(abortErr);
          });
        }

        stream.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > maxSizeBytes) {
            clearTimeout(timer);
            stream.destroy();
            fileWriteStream.destroy();
            const err: any = new Error(
              `Video payload exceeded the maximum allowed size limit (${Math.round(maxSizeBytes / 1024 / 1024)}MB).`,
            );
            err.code = VideoDownloaderErrorCode.REMOTE_TOO_LARGE;
            reject(err);
          }
        });

        stream.pipe(fileWriteStream);

        stream.on('end', () => {
          clearTimeout(timer);
          if (isTimedOut) return;
          fileWriteStream.end(() => {
            resolve();
          });
        });

        stream.on('error', (err: any) => {
          clearTimeout(timer);
          fileWriteStream.destroy();
          const netErr: any = new Error(`YouTube stream download error: ${err.message}`);
          netErr.code = VideoDownloaderErrorCode.DOWNLOAD_FAILED;
          reject(netErr);
        });

        fileWriteStream.on('error', (err: any) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const sanitizedFilename = sanitizeFilename(title, 'youtube_video', 'mp4');

      return {
        tempFilePath,
        filename: sanitizedFilename,
        sizeBytes: downloadedBytes,
        mimeType: 'video/mp4',
        format: 'mp4',
      };
    } catch (err) {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
      throw err;
    }
  }
}
