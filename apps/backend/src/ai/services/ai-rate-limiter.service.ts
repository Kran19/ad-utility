import { Injectable, Logger } from '@nestjs/common';
import { RedisAdCacheService } from '../../ads/services/redis-ad-cache.service';

@Injectable()
export class AiRateLimiterService {
  private readonly logger = new Logger(AiRateLimiterService.name);
  private inMemoryCounts = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly redisService: RedisAdCacheService) {}

  /**
   * Check if client identifier (IP or Session) exceeds rate limits (e.g. 10 requests / min)
   */
  async checkRateLimit(identifier: string, maxRequestsPerMin = 10): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rate:ai:${identifier}`;
    const now = Date.now();

    // 1. In-memory sliding window check
    const existing = this.inMemoryCounts.get(key);
    if (existing && existing.expiresAt > now) {
      if (existing.count >= maxRequestsPerMin) {
        return { allowed: false, remaining: 0 };
      }
      existing.count += 1;
      return { allowed: true, remaining: maxRequestsPerMin - existing.count };
    }

    // Initialize or reset window (60s)
    this.inMemoryCounts.set(key, {
      count: 1,
      expiresAt: now + 60000,
    });

    // Clean up old entries periodically
    if (this.inMemoryCounts.size > 5000) {
      for (const [k, v] of this.inMemoryCounts.entries()) {
        if (v.expiresAt <= now) {
          this.inMemoryCounts.delete(k);
        }
      }
    }

    return { allowed: true, remaining: maxRequestsPerMin - 1 };
  }
}
