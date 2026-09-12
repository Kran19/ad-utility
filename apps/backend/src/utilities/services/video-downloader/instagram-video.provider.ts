import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { VideoSourceProvider, VideoDownloadOptions, VideoDownloadResult } from './video-source-provider.interface';
import { DirectVideoProvider } from './direct-video.provider';
import { VideoDownloaderErrorCode } from '@ad-utility/shared';
import { sanitizeFilename } from '../../adapters/utils/buffer-utils';

export class InstagramVideoProvider implements VideoSourceProvider {
  public readonly name = 'InstagramVideoProvider';
  private readonly directProvider = new DirectVideoProvider();

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    const isInstagramHost = host === 'instagram.com' || host === 'www.instagram.com';
    const isReelOrPost =
      pathname.includes('/reel/') ||
      pathname.includes('/reels/') ||
      pathname.includes('/p/') ||
      pathname.includes('/tv/');
    return isInstagramHost && isReelOrPost;
  }

  public async download(url: URL, options: VideoDownloadOptions = {}): Promise<VideoDownloadResult> {
    const rawUrl = url.toString();

    // 1. Extract post/reel shortcode (e.g., from /reel/C8xxxxxxxx/ or /p/C8xxxxxxxx/)
    const shortcodeMatch = url.pathname.match(/\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/);
    const shortcode = shortcodeMatch ? shortcodeMatch[1] : 'instagram_reel';

    // 2. Resolve direct CDN video URL
    const directVideoUrl = await this.resolveInstagramVideoUrl(url, shortcode);
    if (!directVideoUrl) {
      const err: any = new Error(
        'Unable to retrieve Instagram video. Please make sure the reel or post is public and accessible.',
      );
      err.code = VideoDownloaderErrorCode.REMOTE_NOT_FOUND;
      throw err;
    }

    // 3. Delegate streaming download to DirectVideoProvider
    const parsedDirectUrl = new URL(directVideoUrl);
    const result = await this.directProvider.download(parsedDirectUrl, options);

    // 4. Sanitize title
    const filename = sanitizeFilename(`instagram_reel_${shortcode}`, 'instagram_reel', 'mp4');

    return {
      ...result,
      filename,
    };
  }

  /**
   * Resolve direct MP4 stream URL from public Instagram reel/post
   */
  private async resolveInstagramVideoUrl(url: URL, shortcode: string): Promise<string | null> {
    // Candidates to fetch
    const candidateUrls = [
      `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
      `https://www.instagram.com/reel/${shortcode}/`,
      url.toString(),
    ];

    for (const fetchUrl of candidateUrls) {
      try {
        const html = await this.fetchHtml(fetchUrl);
        if (!html) continue;

        // 1. Check OpenGraph tag: <meta property="og:video" content="..." />
        const ogMatch =
          html.match(/<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+property=["']og:video:secure_url["']\s+content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
          const direct = this.cleanInstagramCdnUrl(ogMatch[1]);
          if (direct) return direct;
        }

        // 2. Check embed video element: <video class="EmbeddedVideo" ... src="..." />
        const videoSrcMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i);
        if (videoSrcMatch && videoSrcMatch[1]) {
          const direct = this.cleanInstagramCdnUrl(videoSrcMatch[1]);
          if (direct) return direct;
        }

        // 3. Check JSON video_url or playable_url inside page scripts
        const jsonMatch =
          html.match(/"video_url"\s*:\s*"([^"]+)"/) ||
          html.match(/"playable_url"\s*:\s*"([^"]+)"/) ||
          html.match(/"video_versions"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
        if (jsonMatch && jsonMatch[1]) {
          const direct = this.cleanInstagramCdnUrl(jsonMatch[1]);
          if (direct) return direct;
        }
      } catch {}
    }

    return null;
  }

  private cleanInstagramCdnUrl(rawUrl: string): string | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    let clean = rawUrl
      .replace(/\\u0026/g, '&')
      .replace(/&amp;/g, '&')
      .replace(/\\\//g, '/');

    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }

    return null;
  }

  private async fetchHtml(targetUrl: string, timeoutMs = 8000): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.request(
        parsed,
        {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
          },
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
            // Prevent reading massive HTML payloads
            if (data.length > 2 * 1024 * 1024) {
              res.destroy();
              resolve(data);
            }
          });
          res.on('end', () => resolve(data));
          res.on('error', (err) => reject(err));
        },
      );

      req.on('timeout', () => {
        req.destroy();
        resolve('');
      });

      req.on('error', () => resolve(''));
      req.end();
    });
  }
}
