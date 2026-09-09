import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceDetectorService } from './device-detector.service';
import { AdSelectorService } from './ad-selector.service';
import { TrackingTokenService } from './tracking-token.service';
import { RedisAdCacheService } from './redis-ad-cache.service';
import { ExternalAdNetworkService } from '../providers/external-ad-network.service';
import {
  AdSlotRequestDto,
  AdSlotResponseDto,
  AdImpressionRequestDto,
  AdClickRequestDto,
  AdClickResponseDto,
} from '@ad-utility/shared';
import { createHash } from 'crypto';
import { EntitlementService } from '../../billing/services/entitlement.service';

@Injectable()
export class AdDeliveryService {
  private readonly logger = new Logger(AdDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceDetector: DeviceDetectorService,
    private readonly adSelector: AdSelectorService,
    private readonly trackingToken: TrackingTokenService,
    private readonly redisCache: RedisAdCacheService,
    private readonly externalAdNetwork: ExternalAdNetworkService,
    private readonly entitlementService: EntitlementService,
  ) {}

  /**
   * Public Ad Slot Delivery
   */
  async getAdForSlot(
    request: AdSlotRequestDto,
    userAgent?: string,
    ip?: string,
    countryHint?: string,
    userId?: string,
  ): Promise<AdSlotResponseDto> {
    const resolvedUserId = userId || request.userId;
    if (resolvedUserId) {
      const showAds = await this.entitlementService.shouldShowAds(resolvedUserId);
      if (!showAds) {
        return {
          hasAd: false,
          placement: request.placement,
          reason: 'PREMIUM_AD_FREE',
        };
      }
    }

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

      if (decoded.provider) {
        // First-party impression event for external provider ad
        this.prisma.analyticsEvent
          .create({
            data: {
              eventType: 'AD_IMPRESSION',
              placementCode: decoded.placementCode,
              utilitySlug: dto.utilitySlug || decoded.utilitySlug,
              sessionToken: dto.sessionId,
              metadata: {
                provider: decoded.provider,
                providerAdId: decoded.providerAdId,
                monetizationSource: 'EXTERNAL_NETWORK',
                deviceType,
                country: dto.country,
              },
            },
          })
          .catch((err) => {
            this.logger.warn(`Failed to persist external ad impression event: ${err.message}`);
          });

        // Notify external ad network asynchronously
        this.externalAdNetwork.recordImpression(dto.trackingToken).catch(() => {});

        return { success: true, recorded: true };
      }

      // 1. Asynchronously persist internal impression in PostgreSQL (non-blocking)
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
    const deviceType = dto.device || decoded.deviceType || 'DESKTOP';

    if (decoded.provider) {
      if (!decoded.externalTargetUrl) {
        throw new NotFoundException('External ad destination target URL not found');
      }

      const targetUrl = decoded.externalTargetUrl.trim();
      if (
        targetUrl.toLowerCase().startsWith('javascript:') ||
        targetUrl.toLowerCase().startsWith('data:')
      ) {
        throw new BadRequestException('Invalid or dangerous target URL scheme');
      }

      // Record first-party click event for external provider ad
      this.prisma.analyticsEvent
        .create({
          data: {
            eventType: 'AD_CLICK',
            placementCode: decoded.placementCode,
            utilitySlug: dto.utilitySlug || decoded.utilitySlug,
            sessionToken: dto.sessionId,
            metadata: {
              provider: decoded.provider,
              providerAdId: decoded.providerAdId,
              monetizationSource: 'EXTERNAL_NETWORK',
              deviceType,
              country: dto.country,
            },
          },
        })
        .catch((err) => {
          this.logger.warn(`Failed to persist external ad click event: ${err.message}`);
        });

      // Notify external provider asynchronously
      this.externalAdNetwork.recordClick(dto.trackingToken).catch(() => {});

      return { destinationUrl: targetUrl };
    }

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
