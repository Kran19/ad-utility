import * as fs from 'fs';
import * as crypto from 'crypto';

export interface StoredVideoArtifact {
  token: string;
  filePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: number;
}

export class VideoDownloadStorageService {
  private static instance: VideoDownloadStorageService;
  private readonly artifacts = new Map<string, StoredVideoArtifact>();
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    // Periodically clean up expired artifacts every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 2 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public static getInstance(): VideoDownloadStorageService {
    if (!VideoDownloadStorageService.instance) {
      VideoDownloadStorageService.instance = new VideoDownloadStorageService();
    }
    return VideoDownloadStorageService.instance;
  }

  /**
   * Register a temporary downloaded video artifact with a 10-minute TTL
   */
  public registerArtifact(artifact: Omit<StoredVideoArtifact, 'token' | 'expiresAt'>, ttlMs = 10 * 60 * 1000): string {
    const token = `vdt_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + ttlMs;

    this.artifacts.set(token, {
      ...artifact,
      token,
      expiresAt,
    });

    return token;
  }

  public getArtifact(token: string): StoredVideoArtifact | null {
    const item = this.artifacts.get(token);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.deleteArtifact(token);
      return null;
    }

    return item;
  }

  public deleteArtifact(token: string): void {
    const item = this.artifacts.get(token);
    if (item) {
      this.artifacts.delete(token);
      try {
        if (fs.existsSync(item.filePath)) {
          fs.unlinkSync(item.filePath);
        }
      } catch {}
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [token, item] of this.artifacts.entries()) {
      if (now > item.expiresAt) {
        this.deleteArtifact(token);
      }
    }
  }
}
