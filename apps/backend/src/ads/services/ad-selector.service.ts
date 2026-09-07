import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisAdCacheService } from './redis-ad-cache.service';
import { TrackingTokenService } from './tracking-token.service';
import {
  AdSlotRequestDto,
  AdSlotResponseDto,
  AdPlacement,
  DeviceType,
  CreativeType,
} from '@ad-utility/shared';
import { PlacementCode, CampaignStatus } from '@prisma/client';

export interface SelectedCandidate {
  ruleId: string;
  campaignId: string;
  creativeId: string;
  placementId: string;
  placementCode: AdPlacement;
  effectivePriority: number;
  weight: number;
  fallbackTier: string;
  creative: {
    id: string;
    name: string;
    type: CreativeType;
    mediaUrl: string | null;
    targetUrl: string | null;
    width: number | null;
    height: number | null;
    altText: string | null;
    customHtml: string | null;
  };
}

@Injectable()
export class AdSelectorService {
  private readonly logger = new Logger(AdSelectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisAdCacheService,
    private readonly trackingTokenService: TrackingTokenService,
  ) {}

  /**
   * Primary Ad Selection Execution
   */
  async selectAd(
    request: AdSlotRequestDto,
    device: DeviceType,
    country?: string,
    sessionId = 'anonymous_session',
  ): Promise<AdSlotResponseDto> {
    const placementCode = request.placement as PlacementCode;
    const validPlacements = Object.values(PlacementCode);

    if (!validPlacements.includes(placementCode)) {
      return {
        hasAd: false,
        placement: request.placement,
        fallbackTier: 'TIER_5_NO_AD',
        sessionId,
      };
    }

    const now = new Date();
    const currentDayOfWeek = now.getUTCDay(); // 0 = Sunday
    const currentHourUtc = now.getUTCHours();

    try {
      // 1. Query active targeting rules matching placement & schedule
      const rules = await this.prisma.adTargetingRule.findMany({
        where: {
          isActive: true,
          placement: { code: placementCode },
          campaign: {
            status: CampaignStatus.ACTIVE,
            OR: [{ startDate: null }, { startDate: { lte: now } }],
            AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
          },
        },
        include: {
          campaign: {
            include: {
              schedules: true,
            },
          },
          creative: true,
          placement: true,
        },
      });

      // 2. Filter rules by schedule, device, geography, and frequency cap
      const eligibleCandidates: SelectedCandidate[] = [];

      for (const rule of rules) {
        // Step 2. Schedule evaluation
        if (rule.campaign.schedules && rule.campaign.schedules.length > 0) {
          const isScheduleMatch = rule.campaign.schedules.some((s) => {
            if (s.dayOfWeek !== currentDayOfWeek) return false;
            return currentHourUtc >= s.startHour && currentHourUtc <= s.endHour;
          });
          if (!isScheduleMatch) continue;
        }

        // Step 3. Device Match
        if (rule.deviceTypes && rule.deviceTypes.length > 0) {
          if (!rule.deviceTypes.includes(device as any)) {
            continue;
          }
        }

        // Step 4. Country / Geographic Match
        if (rule.countries && rule.countries.length > 0) {
          if (!country || !rule.countries.map((c) => c.toUpperCase()).includes(country.toUpperCase())) {
            continue;
          }
        }

        // Step 5. Frequency Cap check in Redis
        const isFreqAllowed = await this.redisCache.checkFrequencyCap(
          rule.campaignId,
          sessionId,
          rule.campaign.dailyImpressionCap,
          rule.campaign.totalImpressionCap,
        );
        if (!isFreqAllowed) {
          continue;
        }

        // Calculate Tier Specificity
        const isExactUtility =
          request.utilitySlug &&
          rule.utilitySlugs &&
          rule.utilitySlugs.includes(request.utilitySlug.toLowerCase());

        const isCategoryMatch =
          request.categorySlug &&
          rule.categorySlugs &&
          rule.categorySlugs.includes(request.categorySlug.toLowerCase());

        // Filter out non-matching utility-specific rules
        if (rule.utilitySlugs && rule.utilitySlugs.length > 0 && !isExactUtility) {
          continue;
        }

        // Filter out non-matching category-specific rules
        if (rule.categorySlugs && rule.categorySlugs.length > 0 && !isCategoryMatch && !isExactUtility) {
          continue;
        }

        let fallbackTier = 'TIER_3_GLOBAL_PLACEMENT';
        if (isExactUtility) {
          fallbackTier = 'TIER_1_EXACT_UTILITY';
        } else if (isCategoryMatch) {
          fallbackTier = 'TIER_2_CATEGORY';
        } else if (rule.creative.isGlobalFallback) {
          fallbackTier = 'TIER_4_GLOBAL_FALLBACK';
        }

        const effectivePriority = rule.priorityOverride ?? rule.campaign.priority ?? 50;

        eligibleCandidates.push({
          ruleId: rule.id,
          campaignId: rule.campaignId,
          creativeId: rule.creativeId,
          placementId: rule.placementId,
          placementCode: rule.placement.code as AdPlacement,
          effectivePriority,
          weight: Math.max(rule.weight || 100, 1),
          fallbackTier,
          creative: {
            id: rule.creative.id,
            name: rule.creative.name,
            type: rule.creative.type as CreativeType,
            mediaUrl: rule.creative.mediaUrl,
            targetUrl: rule.creative.targetUrl,
            width: rule.creative.width,
            height: rule.creative.height,
            altText: rule.creative.altText,
            customHtml: rule.creative.customHtml,
          },
        });
      }

      // 3. Evaluate multi-tier precedence: Tier 1 > Tier 2 > Tier 3 > Tier 4
      const tier1 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_1_EXACT_UTILITY');
      const tier2 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_2_CATEGORY');
      const tier3 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_3_GLOBAL_PLACEMENT');
      const tier4 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_4_GLOBAL_FALLBACK');

      const selectedPool =
        tier1.length > 0
          ? tier1
          : tier2.length > 0
            ? tier2
            : tier3.length > 0
              ? tier3
              : tier4;

      if (selectedPool.length > 0) {
        // 4. Priority selection (highest priority first)
        const highestPriority = Math.max(...selectedPool.map((c) => c.effectivePriority));
        const topPriorityCandidates = selectedPool.filter((c) => c.effectivePriority === highestPriority);

        // 5. Weighted rotation among top priority candidates
        const chosen = this.weightedRandomSelect(topPriorityCandidates);

        // 6. Generate signed tracking token
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: chosen.creativeId,
          campaignId: chosen.campaignId,
          placementId: chosen.placementId,
          placementCode: chosen.placementCode,
          utilitySlug: request.utilitySlug,
          deviceType: device,
        });

        return {
          hasAd: true,
          placement: chosen.placementCode,
          fallbackTier: chosen.fallbackTier,
          sessionId,
          creative: {
            creativeId: chosen.creative.id,
            campaignId: chosen.campaignId,
            type: chosen.creative.type,
            mediaUrl: chosen.creative.mediaUrl || undefined,
            targetUrl: chosen.creative.targetUrl || undefined,
            width: chosen.creative.width || undefined,
            height: chosen.creative.height || undefined,
            altText: chosen.creative.altText || undefined,
            customHtml: chosen.creative.customHtml || undefined,
            trackingToken,
          },
        };
      }

      // 7. Check Global Fallback Creatives without explicit targeting rule
      const globalFallbackCreative = await this.prisma.adCreative.findFirst({
        where: {
          isGlobalFallback: true,
          targetingRules: {
            some: {
              placement: { code: placementCode },
              deviceTypes: { has: device as any },
            },
          },
        },
        include: {
          targetingRules: {
            where: { placement: { code: placementCode } },
            include: { placement: true },
          },
        },
      });

      if (globalFallbackCreative && globalFallbackCreative.targetingRules.length > 0) {
        const rule = globalFallbackCreative.targetingRules[0];
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: globalFallbackCreative.id,
          campaignId: rule.campaignId,
          placementId: rule.placementId,
          placementCode: rule.placement.code as AdPlacement,
          utilitySlug: request.utilitySlug,
          deviceType: device,
        });

        return {
          hasAd: true,
          placement: rule.placement.code as AdPlacement,
          fallbackTier: 'TIER_4_GLOBAL_FALLBACK',
          sessionId,
          creative: {
            creativeId: globalFallbackCreative.id,
            campaignId: rule.campaignId,
            type: globalFallbackCreative.type as CreativeType,
            mediaUrl: globalFallbackCreative.mediaUrl || undefined,
            targetUrl: globalFallbackCreative.targetUrl || undefined,
            width: globalFallbackCreative.width || undefined,
            height: globalFallbackCreative.height || undefined,
            altText: globalFallbackCreative.altText || undefined,
            customHtml: globalFallbackCreative.customHtml || undefined,
            trackingToken,
          },
        };
      }

      // 8. No Ad matched
      return {
        hasAd: false,
        placement: request.placement,
        fallbackTier: 'TIER_5_NO_AD',
        sessionId,
      };
    } catch (err: any) {
      this.logger.error(`Ad selection failure for placement ${request.placement}: ${err.message}`);
      return {
        hasAd: false,
        placement: request.placement,
        fallbackTier: 'TIER_5_NO_AD',
        sessionId,
      };
    }
  }

  /**
   * Deterministic Weighted Random Selection
   */
  private weightedRandomSelect(candidates: SelectedCandidate[]): SelectedCandidate {
    if (candidates.length === 1) {
      return candidates[0];
    }

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;

    for (const candidate of candidates) {
      if (random < candidate.weight) {
        return candidate;
      }
      random -= candidate.weight;
    }

    return candidates[0];
  }
}
