import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceDetectorService } from './device-detector.service';
import { AdSelectorService } from './ad-selector.service';
import { TrackingTokenService } from './tracking-token.service';
import { RedisAdCacheService } from './redis-ad-cache.service';
import {
  AdSlotRequestDto,
  AdSlotResponseDto,
  AdImpressionRequestDto,
  AdClickRequestDto,
  AdClickResponseDto,
} from '@ad-utility/shared';
import { createHash } from 'crypto';

@Injectable()
export class AdDeliveryService {
  private readonly logger = new Logger(AdDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceDetector: DeviceDetectorService,
    private readonly adSelector: AdSelectorService,
    private readonly trackingToken: TrackingTokenService,
    private readonly redisCache: RedisAdCacheService,
  ) {}

  /**
   * Public Ad Slot Delivery
   */
  async getAdForSlot(
    request: AdSlotRequestDto,
    userAgent?: string,
    ip?: string,
    countryHint?: string,
  ): Promise<AdSlotResponseDto> {
    const device = this.deviceDetector.resolveDevice(request.device, userAgent);
    const country = request.country || countryHint;
    const sessionId = request.sessionId || this.generateSessionId(ip, userAgent);

    return this.adSelector.selectAd(request, device, country, sessionId);
  }

  /**
   * Record Ad Impression Asynchronously
   */
  async recordImpression(
    dto: AdImpressionRequestDto,
    ip?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; recorded: boolean }> {
    try {
      const decoded = this.trackingToken.verifyToken(dto.trackingToken);
      const ipHash = ip ? createHash('sha256').update(ip).digest('hex').substring(0, 32) : undefined;
      const uaHash = userAgent
        ? createHash('sha256').update(userAgent).digest('hex').substring(0, 32)
        : undefined;

      const deviceType = dto.device || decoded.deviceType || 'DESKTOP';

      // 1. Asynchronously persist impression in PostgreSQL (non-blocking)
      this.prisma.adImpression
        .create({
          data: {
            creativeId: decoded.creativeId,
            campaignId: decoded.campaignId,
            placementId: decoded.placementId,
            utilitySlug: dto.utilitySlug || decoded.utilitySlug,
            deviceType: deviceType as any,
            country: dto.country,
            ipHash,
            userAgentHash: uaHash,
            sessionToken: dto.sessionId,
          },
        })
        .catch((err) => {
          this.logger.warn(`Failed to persist ad impression in database: ${err.message}`);
        });

      // 2. Increment Redis frequency counter for session
      if (dto.sessionId) {
        this.redisCache.incrementImpression(decoded.campaignId, dto.sessionId).catch(() => {
          // ignore fail-open
        });
      }

      return { success: true, recorded: true };
    } catch (err: any) {
      this.logger.warn(`Impression tracking rejected: ${err.message}`);
      return { success: false, recorded: false };
    }
  }

  /**
   * Record Ad Click and resolve authoritative target URL
   */
  async recordClick(
    dto: AdClickRequestDto,
    ip?: string,
  ): Promise<AdClickResponseDto> {
    const decoded = this.trackingToken.verifyToken(dto.trackingToken);

    // 1. Query creative to get authoritative destination URL
    const creative = await this.prisma.adCreative.findUnique({
      where: { id: decoded.creativeId },
      select: { targetUrl: true },
    });

    if (!creative || !creative.targetUrl) {
      throw new NotFoundException('Ad creative target destination not found');
    }

    // 2. Prevent dangerous schemes (XSS protection)
    const targetUrl = creative.targetUrl.trim();
    if (
      targetUrl.toLowerCase().startsWith('javascript:') ||
      targetUrl.toLowerCase().startsWith('data:')
    ) {
      throw new BadRequestException('Invalid or dangerous target URL scheme');
    }

    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').substring(0, 32) : undefined;
    const deviceType = dto.device || decoded.deviceType || 'DESKTOP';

    // 3. Asynchronously record click event
    this.prisma.adClick
      .create({
        data: {
          creativeId: decoded.creativeId,
          campaignId: decoded.campaignId,
          placementId: decoded.placementId,
          utilitySlug: dto.utilitySlug || decoded.utilitySlug,
          deviceType: deviceType as any,
          country: dto.country,
          ipHash,
          sessionToken: dto.sessionId,
        },
      })
      .catch((err) => {
        this.logger.warn(`Failed to persist ad click in database: ${err.message}`);
      });

    return { destinationUrl: targetUrl };
  }

  private generateSessionId(ip?: string, userAgent?: string): string {
    const raw = `${ip || '127.0.0.1'}_${userAgent || 'unknown_ua'}`;
    return 'sess_' + createHash('sha256').update(raw).digest('hex').substring(0, 16);
  }
}
