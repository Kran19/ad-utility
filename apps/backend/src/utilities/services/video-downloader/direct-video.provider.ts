import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { URL } from 'url';
import { VideoSourceProvider, VideoDownloadOptions, VideoDownloadResult } from './video-source-provider.interface';
import { SsrProtectionService } from '../ssrf-protection.service';
import { validateVideoMagicBytes, sanitizeFilename } from '../../adapters/utils/buffer-utils';
import { VideoDownloaderErrorCode } from '@ad-utility/shared';

export class DirectVideoProvider implements VideoSourceProvider {
  public readonly name = 'DirectVideoProvider';

  public canHandle(url: URL): boolean {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  public async download(url: URL, options: VideoDownloadOptions = {}): Promise<VideoDownloadResult> {
    const maxSizeBytes = options.maxSizeBytes || 50 * 1024 * 1024; // 50MB default
    const timeoutMs = options.timeoutMs || 30000; // 30s default
    const maxRedirects = options.maxRedirects ?? SsrProtectionService.MAX_REDIRECTS;

    let currentUrl = url;
    let redirectCount = 0;

    const tempId = crypto.randomBytes(12).toString('hex');
    const tempFilePath = path.join(os.tmpdir(), `vdl_${Date.now()}_${tempId}.tmp`);

    const cleanupTempFile = async () => {
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }
      } catch {}
    };

    try {
      while (true) {
        // 1. SSRF Validation for current hop
        const ssrfCheck = await SsrProtectionService.validateUrl(currentUrl.toString());
        if (!ssrfCheck.isValid) {
          const err: any = new Error(ssrfCheck.errorMessage || 'Destination URL failed SSRF security checks.');
          err.code = ssrfCheck.errorCode || VideoDownloaderErrorCode.SSRF_BLOCKED;
          throw err;
        }

        const isHttps = currentUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        const agent = SsrProtectionService.createSecureAgent(isHttps);

        const requestPromise = new Promise<{
          statusCode: number;
          headers: http.IncomingHttpHeaders;
          stream: http.IncomingMessage;
        }>((resolve, reject) => {
          const req = client.request(
            currentUrl,
            {
              method: 'GET',
              agent,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UtilityPlatform/1.0',
                Accept: 'video/*,*/*;q=0.8',
                'Accept-Encoding': 'identity', // Avoid compressed payload bypassing byte counters
              },
              timeout: 10000, // 10s connection timeout
            },
            (res) => {
              resolve({
                statusCode: res.statusCode || 500,
                headers: res.headers,
                stream: res,
              });
            },
          );

          req.on('timeout', () => {
            req.destroy();
            const err: any = new Error('Remote connection timed out.');
            err.code = VideoDownloaderErrorCode.REMOTE_TIMEOUT;
            reject(err);
          });

          req.on('error', (err: any) => {
            if (err.code === 'SSRF_BLOCKED') {
              reject(err);
            } else {
              const netErr: any = new Error(`Connection to source failed: ${err.message}`);
              netErr.code = VideoDownloaderErrorCode.DOWNLOAD_FAILED;
              reject(netErr);
            }
          });

          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              req.destroy();
              const abortErr: any = new Error('Download aborted by client.');
              abortErr.code = 'ABORTED';
              reject(abortErr);
            });
          }

          req.end();
        });

        const { statusCode, headers, stream } = await requestPromise;

        // 2. Handle HTTP Redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          stream.resume(); // Drain stream
          redirectCount++;
          if (redirectCount > maxRedirects) {
            const err: any = new Error(`Too many redirects (maximum ${maxRedirects} hops exceeded).`);
            err.code = VideoDownloaderErrorCode.INVALID_URL;
            throw err;
          }

          const location = headers.location;
          if (!location) {
            const err: any = new Error('Remote server responded with redirect but missing Location header.');
            err.code = VideoDownloaderErrorCode.DOWNLOAD_FAILED;
            throw err;
          }

          // Resolve relative redirect against current URL
          currentUrl = new URL(location, currentUrl);
          continue;
        }

        // 3. Handle HTTP Errors
        if (statusCode === 404) {
          stream.resume();
          const err: any = new Error('Video not found on remote server (404).');
          err.code = VideoDownloaderErrorCode.REMOTE_NOT_FOUND;
          throw err;
        }
        if (statusCode === 403 || statusCode === 401) {
          stream.resume();
          const err: any = new Error('Access to video is forbidden by remote server (403/401).');
          err.code = VideoDownloaderErrorCode.REMOTE_FORBIDDEN;
          throw err;
        }
        if (statusCode < 200 || statusCode >= 300) {
          stream.resume();
          const err: any = new Error(`Remote server responded with HTTP status ${statusCode}.`);
          err.code = VideoDownloaderErrorCode.DOWNLOAD_FAILED;
          throw err;
        }

        // 4. Validate Content-Length header (if present)
        const contentLengthHeader = headers['content-length'];
        if (contentLengthHeader) {
          const declaredLength = parseInt(contentLengthHeader, 10);
          if (!isNaN(declaredLength) && declaredLength > maxSizeBytes) {
            stream.resume();
            const err: any = new Error(
              `Video size (${Math.round(declaredLength / 1024 / 1024)}MB) exceeds the maximum allowed limit of ${Math.round(
                maxSizeBytes / 1024 / 1024,
              )}MB.`,
            );
            err.code = VideoDownloaderErrorCode.REMOTE_TOO_LARGE;
            throw err;
          }
        }

        // 5. Extract suggested filename from Content-Disposition or URL path
        let suggestedName = 'video.mp4';
        const contentDisposition = headers['content-disposition'];
        if (contentDisposition) {
          const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
          if (match && match[1]) {
            suggestedName = decodeURIComponent(match[1]);
          }
        } else {
          const urlPath = currentUrl.pathname;
          const base = path.basename(urlPath);
          if (base && base.length > 0 && !base.startsWith('.')) {
            suggestedName = decodeURIComponent(base);
          }
        }

        // 6. Stream Download with byte counter & timeout
        const fileWriteStream = fs.createWriteStream(tempFilePath);
        let downloadedBytes = 0;
        const initialInspectionBuffer: Buffer[] = [];
        let inspectionBytesCollected = 0;
        const REQUIRED_HEADER_BYTES = 512;

        await new Promise<void>((resolve, reject) => {
          let isTimedOut = false;
          const downloadTimer = setTimeout(() => {
            isTimedOut = true;
            stream.destroy();
            fileWriteStream.destroy();
            const err: any = new Error(`Download timed out after ${Math.round(timeoutMs / 1000)}s.`);
            err.code = VideoDownloaderErrorCode.REMOTE_TIMEOUT;
            reject(err);
          }, timeoutMs);

          stream.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;

            // Collect early bytes for magic-byte check
            if (inspectionBytesCollected < REQUIRED_HEADER_BYTES) {
              initialInspectionBuffer.push(chunk);
              inspectionBytesCollected += chunk.length;
            }

            // Hard ceiling check
            if (downloadedBytes > maxSizeBytes) {
              clearTimeout(downloadTimer);
              stream.destroy();
              fileWriteStream.destroy();
              const err: any = new Error(
                `Video payload exceeded the maximum allowed size limit (${Math.round(maxSizeBytes / 1024 / 1024)}MB).`,
              );
              err.code = VideoDownloaderErrorCode.REMOTE_TOO_LARGE;
              reject(err);
              return;
            }

            fileWriteStream.write(chunk);
          });

          stream.on('end', () => {
            clearTimeout(downloadTimer);
            if (isTimedOut) return;
            fileWriteStream.end(() => {
              resolve();
            });
          });

          stream.on('error', (err) => {
            clearTimeout(downloadTimer);
            fileWriteStream.destroy();
            const netErr: any = new Error(`Stream download error: ${err.message}`);
            netErr.code = VideoDownloaderErrorCode.DOWNLOAD_FAILED;
            reject(netErr);
          });

          fileWriteStream.on('error', (err) => {
            clearTimeout(downloadTimer);
            stream.destroy();
            reject(err);
          });
        });

        if (downloadedBytes === 0) {
          const err: any = new Error('Downloaded video stream is empty.');
          err.code = VideoDownloaderErrorCode.INVALID_MEDIA;
          throw err;
        }

        // 7. Validate magic bytes from initial downloaded buffer
        const headerBuffer = Buffer.concat(initialInspectionBuffer).subarray(0, REQUIRED_HEADER_BYTES);
        let mediaFormatInfo: { format: 'mp4' | 'webm' | 'mov' | 'avi' | 'mkv'; mimeType: string };
        try {
          mediaFormatInfo = validateVideoMagicBytes(headerBuffer);
        } catch (err: any) {
          const formatErr: any = new Error(err.message || 'Invalid or unrecognized video signature.');
          formatErr.code = VideoDownloaderErrorCode.INVALID_MEDIA;
          throw formatErr;
        }

        // 8. Sanitize final filename
        const safeExt = mediaFormatInfo.format;
        const sanitizedFilename = sanitizeFilename(suggestedName, 'downloaded_video', safeExt);

        return {
          tempFilePath,
          filename: sanitizedFilename,
          sizeBytes: downloadedBytes,
          mimeType: mediaFormatInfo.mimeType,
          format: mediaFormatInfo.format,
        };
      }
    } catch (err) {
      await cleanupTempFile();
      throw err;
    }
  }
}
