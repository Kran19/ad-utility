import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AdSlotResponseDto } from '@ad-utility/shared';

@Injectable()
export class RedisAdCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisAdCacheService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly config: ConfigService) {
    this.initClient();
  }

  private initClient() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST', 'localhost');
    const port = this.config.get<number>('REDIS_PORT', 6379);
    const password = this.config.get<string>('REDIS_PASSWORD');

    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        });
      } else {
        this.client = new Redis({
          host,
          port,
          password: password || undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        });
      }

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connection established for Ad Engine caching and frequency capping.');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis disconnected/unavailable (failing open): ${err.message}`);
      });

      this.client.connect().catch((err) => {
        this.isConnected = false;
        this.logger.warn(`Redis initial connect failed (failing open): ${err.message}`);
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`Failed to initialize Redis client: ${err.message}`);
    }
  }

  /**
   * Check if Redis is currently connected and healthy
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Atomic Frequency Cap Check
   * Returns true if request is within frequency limits or if Redis fails open.
   */
  async checkFrequencyCap(
    campaignId: string,
    sessionId: string,
    dailyCap?: number | null,
    totalCap?: number | null,
  ): Promise<boolean> {
    if (!this.isAvailable() || !this.client || (!dailyCap && !totalCap)) {
      return true; // Fail open
    }

    try {
      const now = new Date();
      const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;

      if (dailyCap && dailyCap > 0) {
        const dailyKey = `freq:camp:${campaignId}:sess:${sessionId}:day:${dateKey}`;
        const currentDaily = await this.client.get(dailyKey);
        if (currentDaily && parseInt(currentDaily, 10) >= dailyCap) {
          return false;
        }
      }

      if (totalCap && totalCap > 0) {
        const totalKey = `freq:camp:${campaignId}:sess:${sessionId}:total`;
        const currentTotal = await this.client.get(totalKey);
        if (currentTotal && parseInt(currentTotal, 10) >= totalCap) {
          return false;
        }
      }

      return true;
    } catch (err: any) {
      this.logger.warn(`Frequency cap check error (failing open): ${err.message}`);
      return true;
    }
  }

  /**
   * Increment Frequency Cap Counters atomically
   */
  async incrementImpression(campaignId: string, sessionId: string): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      const now = new Date();
      const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
      const dailyKey = `freq:camp:${campaignId}:sess:${sessionId}:day:${dateKey}`;
      const totalKey = `freq:camp:${campaignId}:sess:${sessionId}:total`;

      const pipeline = this.client.pipeline();
      pipeline.incr(dailyKey);
      pipeline.expire(dailyKey, 86400 * 2); // 48h TTL
      pipeline.incr(totalKey);
      pipeline.expire(totalKey, 86400 * 30); // 30d TTL
      await pipeline.exec();
    } catch (err: any) {
      this.logger.warn(`Failed to increment frequency counter in Redis: ${err.message}`);
    }
  }

  /**
   * Get cached ad slot response
   */
  async getCachedSlot(cacheKey: string): Promise<AdSlotResponseDto | null> {
    if (!this.isAvailable() || !this.client) {
      return null;
    }
    try {
      const data = await this.client.get(`cache:adslot:${cacheKey}`);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Set cached ad slot response with TTL
   */
  async setCachedSlot(cacheKey: string, response: AdSlotResponseDto, ttlSeconds = 60): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }
    try {
      await this.client.set(`cache:adslot:${cacheKey}`, JSON.stringify(response), 'EX', ttlSeconds);
    } catch {
      // ignore
    }
  }

  /**
   * Invalidate ad cache keys
   */
  async invalidateCache(pattern = 'cache:adslot:*'): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // ignore
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
