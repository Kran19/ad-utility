import { URL } from 'url';

export interface VideoDownloadOptions {
  maxSizeBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
}

export interface VideoDownloadResult {
  tempFilePath: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  format: 'mp4' | 'webm' | 'mov' | 'avi' | 'mkv';
}

export interface VideoSourceProvider {
  name: string;
  canHandle(url: URL): boolean;
  download(url: URL, options: VideoDownloadOptions): Promise<VideoDownloadResult>;
}
