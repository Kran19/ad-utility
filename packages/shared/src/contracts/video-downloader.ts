/**
 * Contracts for Phase 28 Video Downloader Utility (video-downloader)
 */

export interface VideoDownloaderInput {
  url: string;
}

export interface VideoDownloaderOutput {
  downloadUrl: string;
  downloadToken: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  format: string;
  duration?: number;
  width?: number;
  height?: number;
}

export enum VideoDownloaderErrorCode {
  INVALID_URL = 'INVALID_URL',
  UNSUPPORTED_PROTOCOL = 'UNSUPPORTED_PROTOCOL',
  UNSUPPORTED_SOURCE = 'UNSUPPORTED_SOURCE',
  SSRF_BLOCKED = 'SSRF_BLOCKED',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  REMOTE_NOT_FOUND = 'REMOTE_NOT_FOUND',
  REMOTE_FORBIDDEN = 'REMOTE_FORBIDDEN',
  REMOTE_TIMEOUT = 'REMOTE_TIMEOUT',
  REMOTE_TOO_LARGE = 'REMOTE_TOO_LARGE',
  INVALID_MEDIA = 'INVALID_MEDIA',
  UNSUPPORTED_MEDIA = 'UNSUPPORTED_MEDIA',
  MEDIA_TOO_LONG = 'MEDIA_TOO_LONG',
  MEDIA_TOO_LARGE = 'MEDIA_TOO_LARGE',
  MEDIA_RESOLUTION_TOO_HIGH = 'MEDIA_RESOLUTION_TOO_HIGH',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
}
