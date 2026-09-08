import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class UtilitiesCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(UtilitiesCacheService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private readonly defaultTtlSeconds = 300; // 5 minutes

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
        this.logger.log('Utilities Redis Cache connected');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Utilities Redis Cache error (failing open): ${err.message}`);
      });

      this.client.connect().catch((err) => {
        this.isConnected = false;
        this.logger.warn(`Utilities Redis Cache initial connection failed: ${err.message}`);
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`Utilities Redis Cache initialization failed: ${err.message}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      const data = await this.client.get(`utility_cache:${key}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = this.defaultTtlSeconds): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.set(
        `utility_cache:${key}`,
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch {
      // fail open
    }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const keys = await this.client.keys(`utility_cache:${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // fail open
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }
}
