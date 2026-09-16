import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { ExternalAdNetworkService } from '../providers/external-ad-network.service';

export const FALLBACK_BANNER_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=200&fit=crop&q=80';

export function formatGlobalFallbackHtml(mediaUrl?: string): string {
  const bannerUrl = mediaUrl || FALLBACK_BANNER_IMAGE;
  return `<div style="width:100%;max-width:728px;margin:0 auto;position:relative;overflow:hidden;border-radius:8px;border:1px solid #1e293b;background:#0f172a;display:flex;align-items:center;justify-content:center;cursor:pointer;"><img src="${bannerUrl}" alt="⚡ Global Platform Sponsor • Fast Utilities" style="width:100%;max-height:100px;object-fit:cover;display:block;" /><div style="position:absolute;bottom:6px;left:10px;background:rgba(15,23,42,0.85);backdrop-filter:blur(4px);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#38bdf8;border:1px solid rgba(56,189,248,0.25);display:flex;align-items:center;gap:4px;">⚡ Global Platform Sponsor &bull; Fast Utilities</div></div>`;
}

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
export class AdSelectorService implements OnModuleInit {
  private readonly logger = new Logger(AdSelectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisAdCacheService,
    private readonly trackingTokenService: TrackingTokenService,
    private readonly externalAdNetwork: ExternalAdNetworkService,
  ) {}

  async onModuleInit() {
    try {
      const bannerHtml = formatGlobalFallbackHtml();
      await this.prisma.adCreative.updateMany({
        where: {
          OR: [
            { isGlobalFallback: true },
            { customHtml: { contains: 'Global Platform Sponsor' } },
            { name: { contains: 'Global Fallback' } },
          ],
        },
        data: {
          customHtml: bannerHtml,
          mediaUrl: FALLBACK_BANNER_IMAGE,
        },
      });
      this.logger.log('Fallback ad creatives successfully synced with image banner');
    } catch (err: any) {
      this.logger.warn(`Could not sync fallback ad creatives: ${err.message}`);
    }
  }

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
      // 1. Resolve categorySlug if utilitySlug is provided but categorySlug was omitted
      let categorySlug = request.categorySlug?.toLowerCase();
      if (request.utilitySlug && !categorySlug) {
        try {
          const utility = await this.prisma.utility.findUnique({
            where: { slug: request.utilitySlug.toLowerCase() },
            include: { category: true },
          });
          if (utility?.category?.slug) {
            categorySlug = utility.category.slug.toLowerCase();
          }
        } catch (err: any) {
          this.logger.warn(`Could not resolve category for utility ${request.utilitySlug}: ${err.message}`);
        }
      }

      // 2. Query active targeting rules matching placement & schedule
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

      // 3. Filter rules by schedule, device, geography, frequency cap, and utility assignment
      const eligibleCandidates: SelectedCandidate[] = [];

      for (const rule of rules) {
        // Step 3a. Schedule evaluation
        if (rule.campaign.schedules && rule.campaign.schedules.length > 0) {
          const isScheduleMatch = rule.campaign.schedules.some((s) => {
            if (s.dayOfWeek !== currentDayOfWeek) return false;
            return currentHourUtc >= s.startHour && currentHourUtc <= s.endHour;
          });
          if (!isScheduleMatch) continue;
        }

        // Step 3b. Device Match
        if (rule.deviceTypes && rule.deviceTypes.length > 0) {
          if (!rule.deviceTypes.includes(device as any)) {
            continue;
          }
        }

        // Step 3c. Country / Geographic Match
        if (rule.countries && rule.countries.length > 0) {
          if (!country || !rule.countries.map((c) => c.toUpperCase()).includes(country.toUpperCase())) {
            continue;
          }
        }

        // Step 3d. Frequency Cap check in Redis
        const isFreqAllowed = await this.redisCache.checkFrequencyCap(
          rule.campaignId,
          sessionId,
          rule.campaign.dailyImpressionCap,
          rule.campaign.totalImpressionCap,
        );
        if (!isFreqAllowed) {
          continue;
        }

        // Step 3e. Scope & Tier Specificity
        const isExactUtility = Boolean(
          request.utilitySlug &&
          rule.utilitySlugs &&
          rule.utilitySlugs.some((s) => s.toLowerCase() === request.utilitySlug?.toLowerCase())
        );

        const isCategoryMatch = Boolean(
          categorySlug &&
          rule.categorySlugs &&
          rule.categorySlugs.some((s) => s.toLowerCase() === categorySlug?.toLowerCase())
        );

        const isHomeRequest = request.utilitySlug?.toLowerCase() === 'home';
        const isGlobalRule = (!rule.utilitySlugs || rule.utilitySlugs.length === 0) &&
          (!rule.categorySlugs || rule.categorySlugs.length === 0);

        // STRICT TOOL ASSIGNMENT CHECK:
        if (isHomeRequest) {
          if (!isExactUtility && !isGlobalRule) {
            continue;
          }
        } else if (request.utilitySlug) {
          if (!isExactUtility && !isCategoryMatch) {
            continue;
          }
        } else {
          // If general / non-utility page, do not serve rules targeted exclusively to specific tools/categories
          if (rule.utilitySlugs && rule.utilitySlugs.length > 0 && !isExactUtility) {
            continue;
          }
          if (rule.categorySlugs && rule.categorySlugs.length > 0 && !isCategoryMatch) {
            continue;
          }
        }

        let fallbackTier = 'TIER_3_GLOBAL_PLACEMENT';
        if (isExactUtility) {
          fallbackTier = 'TIER_1_EXACT_UTILITY';
        } else if (isCategoryMatch) {
          fallbackTier = 'TIER_2_CATEGORY';
        } else if (isHomeRequest && isGlobalRule) {
          fallbackTier = 'TIER_1_EXACT_UTILITY';
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

      // 4. Evaluate Tier Candidates
      const tier1 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_1_EXACT_UTILITY');
      const tier2 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_2_CATEGORY');
      const tier3 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_3_GLOBAL_PLACEMENT');
      const tier4 = eligibleCandidates.filter((c) => c.fallbackTier === 'TIER_4_GLOBAL_FALLBACK');

      let selectedPool: SelectedCandidate[] = [];

      if (request.utilitySlug) {
        // If request is for a utility tool or home page
        if (tier1.length > 0) {
          selectedPool = tier1;
        } else if (tier2.length > 0) {
          selectedPool = tier2;
        } else if (request.utilitySlug.toLowerCase() === 'home' && tier3.length > 0) {
          selectedPool = tier3;
        } else if (request.utilitySlug.toLowerCase() === 'home' && tier4.length > 0) {
          selectedPool = tier4;
        } else {
          // No ad assigned to this tool or category in admin panel -> strictly DO NOT show ad
          return {
            hasAd: false,
            placement: request.placement,
            fallbackTier: 'TIER_5_NO_AD',
            sessionId,
          };
        }
      } else {
        selectedPool =
          tier1.length > 0
            ? tier1
            : tier2.length > 0
              ? tier2
              : tier3.length > 0
                ? tier3
                : [];
      }

      if (selectedPool.length > 0) {
        // 5. Priority selection (highest priority first)
        const highestPriority = Math.max(...selectedPool.map((c) => c.effectivePriority));
        const topPriorityCandidates = selectedPool.filter((c) => c.effectivePriority === highestPriority);

        // 6. Weighted rotation among top priority candidates
        const chosen = this.weightedRandomSelect(topPriorityCandidates);

        // 7. Generate signed tracking token
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
          monetizationSource: 'INTERNAL',
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
            monetizationSource: 'INTERNAL',
          },
        };
      }

      // If utilitySlug is set and no assigned ads exist, immediately return NO_AD
      if (request.utilitySlug) {
        return {
          hasAd: false,
          placement: request.placement,
          fallbackTier: 'TIER_5_NO_AD',
          sessionId,
        };
      }

      // Tier B: External Ad Provider (only for general/global requests without utilitySlug)
      // Evaluated only when no internal campaign targeting rules match
      const externalAd = await this.externalAdNetwork.requestAd(request, {
        device,
        country,
        sessionId,
      });

      if (externalAd) {
        const providerName = this.externalAdNetwork.getProviderName();
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: externalAd.providerAdId,
          campaignId: `ext_campaign_${externalAd.providerAdId}`,
          placementId: `ext_placement_${request.placement}`,
          placementCode: request.placement,
          utilitySlug: request.utilitySlug,
          deviceType: device,
          provider: providerName,
          providerAdId: externalAd.providerAdId,
          externalTargetUrl: externalAd.targetUrl,
        });

        return {
          hasAd: true,
          placement: request.placement,
          fallbackTier: 'TIER_EXTERNAL_PROVIDER',
          sessionId,
          provider: providerName,
          providerRequestId: `req_${Date.now()}`,
          monetizationSource: 'EXTERNAL_NETWORK',
          creative: {
            creativeId: externalAd.providerAdId,
            campaignId: `ext_campaign_${externalAd.providerAdId}`,
            type: externalAd.creativeType,
            mediaUrl: externalAd.mediaUrl,
            targetUrl: externalAd.targetUrl,
            width: externalAd.width,
            height: externalAd.height,
            altText: externalAd.altText,
            customHtml: externalAd.customHtml,
            trackingToken,
            provider: providerName,
            providerAdId: externalAd.providerAdId,
            monetizationSource: 'EXTERNAL_NETWORK',
            revenueEligible: externalAd.revenueEligible,
            externalMetadata: externalAd.externalMetadata,
          },
        };
      }

      // Tier C: House / Global Fallback Creatives
      if (tier4.length > 0) {
        const chosen = this.weightedRandomSelect(tier4);
        const trackingToken = this.trackingTokenService.generateToken({
          creativeId: chosen.creativeId,
          campaignId: chosen.campaignId,
          placementId: chosen.placementId,
          placementCode: chosen.placementCode,
          utilitySlug: request.utilitySlug,
          deviceType: device,
        });

        let customHtml = chosen.creative.customHtml || undefined;
        let mediaUrl = chosen.creative.mediaUrl || FALLBACK_BANNER_IMAGE;

        // Upgrade text fallback creative to rich image banner
        if (!customHtml || customHtml.includes('Global Platform Sponsor') || chosen.creative.type === 'HTML') {
          customHtml = formatGlobalFallbackHtml(mediaUrl);
        }

        return {
          hasAd: true,
          placement: chosen.placementCode,
          fallbackTier: 'TIER_4_GLOBAL_FALLBACK',
          sessionId,
          monetizationSource: 'HOUSE_FALLBACK',
          creative: {
            creativeId: chosen.creative.id,
            campaignId: chosen.campaignId,
            type: chosen.creative.type,
            mediaUrl,
            targetUrl: chosen.creative.targetUrl || undefined,
            width: chosen.creative.width || 728,
            height: chosen.creative.height || 90,
            altText: chosen.creative.altText || 'Global Platform Sponsor • Fast Utilities',
            customHtml,
            trackingToken,
            monetizationSource: 'HOUSE_FALLBACK',
          },
        };
      }

      // If not in targeting rules, check unmapped global fallback creatives
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

        let customHtml = globalFallbackCreative.customHtml || undefined;
        let mediaUrl = globalFallbackCreative.mediaUrl || FALLBACK_BANNER_IMAGE;

        if (!customHtml || customHtml.includes('Global Platform Sponsor') || globalFallbackCreative.type === 'HTML') {
          customHtml = formatGlobalFallbackHtml(mediaUrl);
        }

        return {
          hasAd: true,
          placement: rule.placement.code as AdPlacement,
          fallbackTier: 'TIER_4_GLOBAL_FALLBACK',
          sessionId,
          monetizationSource: 'HOUSE_FALLBACK',
          creative: {
            creativeId: globalFallbackCreative.id,
            campaignId: rule.campaignId,
            type: globalFallbackCreative.type as CreativeType,
            mediaUrl,
            targetUrl: globalFallbackCreative.targetUrl || undefined,
            width: globalFallbackCreative.width || 728,
            height: globalFallbackCreative.height || 90,
            altText: globalFallbackCreative.altText || 'Global Platform Sponsor • Fast Utilities',
            customHtml,
            trackingToken,
            monetizationSource: 'HOUSE_FALLBACK',
          },
        };
      }

      // Tier D: No Ad matched
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
