import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GrowthIntelligenceDto,
  FunnelMetricsDto,
  FunnelStageMetricDto,
  AcquisitionIntelligenceDto,
  UtilityIntelligenceDto,
  AdMonetizationIntelligenceDto,
  PlacementPerformanceDto,
  ExperimentResultDto,
  ExperimentDto,
  ExperimentVariantMetricDto,
} from '@ad-utility/shared';

// Standard active A/B experiments registered for the platform
const ACTIVE_EXPERIMENTS: ExperimentDto[] = [
  {
    id: 'exp_cta_wording',
    name: 'Primary CTA Wording Test',
    description: 'Test "Convert Now" vs "Start Free" vs "Process Instant" on utility execution buttons',
    status: 'ACTIVE',
    variants: [
      { id: 'control', name: 'Convert Now / Execute (Control)', weight: 50 },
      { id: 'variant_a', name: 'Start Free & Instant', weight: 50 },
    ],
  },
  {
    id: 'exp_workspace_layout',
    name: 'Workspace Layout Density',
    description: 'Test Compact vs Expanded workspace view for multi-step PDF/Image tools',
    status: 'ACTIVE',
    variants: [
      { id: 'control', name: 'Standard Layout', weight: 50 },
      { id: 'variant_compact', name: 'Compact Focused Layout', weight: 50 },
    ],
  },
  {
    id: 'exp_ad_placement_priority',
    name: 'Sticky vs In-Content Ad Priority',
    description: 'Evaluate CTR on AFTER_TOOL placement vs DESKTOP_STICKY',
    status: 'ACTIVE',
    variants: [
      { id: 'control', name: 'Standard Placements', weight: 50 },
      { id: 'variant_sticky_focus', name: 'Sticky Priority Layout', weight: 50 },
    ],
  },
];

@Injectable()
export class GrowthIntelligenceService {
  private readonly logger = new Logger(GrowthIntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return list of active registered experiments
   */
  getRegisteredExperiments(): ExperimentDto[] {
    return ACTIVE_EXPERIMENTS;
  }

  /**
   * Main Growth Intelligence Aggregator
   */
  async getGrowthIntelligence(days: number = 30): Promise<GrowthIntelligenceDto> {
    const periodDays = Math.max(1, Math.min(days, 365));
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [
      eventsByType,
      eventsByUtilityAndType,
      utmSources,
      placements,
      impressionsByPlacement,
      clicksByPlacement,
      impressionsByDevice,
      clicksByDevice,
      campaigns,
      impressionsByCampaign,
      clicksByCampaign,
      activeUtilities,
      experimentExposures,
      totalImpressionCount,
      totalClickCount,
    ] = await Promise.all([
      // 1. Funnel counts
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 2. Utility event counts
      this.prisma.analyticsEvent.groupBy({
        by: ['utilitySlug', 'eventType'],
        where: { timestamp: { gte: cutoff }, utilitySlug: { not: null } },
        _count: { _all: true },
      }),
      // 3. Acquisition UTMs
      this.prisma.analyticsEvent.groupBy({
        by: ['utmSource', 'utmMedium', 'utmCampaign'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 4. Placements
      this.prisma.adPlacement.findMany({
        select: { id: true, code: true, name: true },
      }),
      // 5. Ad Impressions by placement
      this.prisma.adImpression.groupBy({
        by: ['placementId'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 6. Ad Clicks by placement
      this.prisma.adClick.groupBy({
        by: ['placementId'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 7. Impressions by device
      this.prisma.adImpression.groupBy({
        by: ['deviceType'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 8. Clicks by device
      this.prisma.adClick.groupBy({
        by: ['deviceType'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 9. Campaigns
      this.prisma.adCampaign.findMany({
        select: { id: true, name: true },
      }),
      // 10. Impressions by campaign
      this.prisma.adImpression.groupBy({
        by: ['campaignId'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 11. Clicks by campaign
      this.prisma.adClick.groupBy({
        by: ['campaignId'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      // 12. Utilities catalog
      this.prisma.utility.findMany({
        select: { slug: true, name: true, category: { select: { slug: true } } },
      }),
      // 13. Experiment exposure events
      this.prisma.analyticsEvent.findMany({
        where: {
          timestamp: { gte: cutoff },
          eventType: 'EXPERIMENT_EXPOSURE',
        },
        select: {
          sessionToken: true,
          metadata: true,
        },
        take: 1000,
      }),
      // 14. Total impression count
      this.prisma.adImpression.count({
        where: { timestamp: { gte: cutoff } },
      }),
      // 15. Total click count
      this.prisma.adClick.count({
        where: { timestamp: { gte: cutoff } },
      }),
    ]);

    // ==========================================
    // 1. FUNNEL INTELLIGENCE
    // ==========================================
    const eventCounts: Record<string, number> = {};
    for (const e of eventsByType) {
      eventCounts[e.eventType] = e._count._all;
    }

    const pageViews = eventCounts['PAGE_VIEW'] || 0;
    const toolStarts = eventCounts['TOOL_START'] || 0;
    const toolCompletions = eventCounts['TOOL_COMPLETE'] || 0;
    const resultDownloads = eventCounts['RESULT_DOWNLOAD'] || 0;
    const toolErrors = eventCounts['TOOL_ERROR'] || 0;

    const viewToStartRate = pageViews > 0 ? Math.round((toolStarts / pageViews) * 1000) / 10 : 0;
    const startToCompleteRate =
      toolStarts > 0
        ? Math.round((toolCompletions / toolStarts) * 1000) / 10
        : toolCompletions > 0
          ? 100
          : 0;
    const completeToDownloadRate =
      toolCompletions > 0 ? Math.round((resultDownloads / toolCompletions) * 1000) / 10 : 0;
    const overallConversionRate =
      pageViews > 0 ? Math.round((resultDownloads / pageViews) * 1000) / 10 : 0;

    const stages: FunnelStageMetricDto[] = [
      {
        stage: 'Landing / Page View',
        count: pageViews,
        conversionRate: 100,
        dropOffRate: pageViews > 0 ? Math.max(0, Math.round(((pageViews - toolStarts) / pageViews) * 1000) / 10) : 0,
      },
      {
        stage: 'Tool Interaction / Start',
        count: toolStarts,
        conversionRate: viewToStartRate,
        dropOffRate: toolStarts > 0 ? Math.max(0, Math.round(((toolStarts - toolCompletions) / toolStarts) * 1000) / 10) : 0,
      },
      {
        stage: 'Tool Execution / Complete',
        count: toolCompletions,
        conversionRate: startToCompleteRate,
        dropOffRate: toolCompletions > 0 ? Math.max(0, Math.round(((toolCompletions - resultDownloads) / toolCompletions) * 1000) / 10) : 0,
      },
      {
        stage: 'Result Download / Export',
        count: resultDownloads,
        conversionRate: completeToDownloadRate,
        dropOffRate: 0,
      },
    ];

    const funnel: FunnelMetricsDto = {
      pageViews,
      toolStarts,
      toolCompletions,
      resultDownloads,
      toolErrors,
      viewToStartRate,
      startToCompleteRate,
      completeToDownloadRate,
      overallConversionRate,
      stages,
    };

    // ==========================================
    // 2. ACQUISITION INTELLIGENCE
    // ==========================================
    let directVisits = 0;
    let campaignVisits = 0;
    const sourceMap = new Map<string, number>();
    const campaignMap = new Map<string, { campaign: string; source: string; visits: number }>();

    for (const u of utmSources) {
      const source = u.utmSource || 'direct';
      const visits = u._count._all;

      if (!u.utmSource || u.utmSource === 'direct') {
        directVisits += visits;
      } else {
        campaignVisits += visits;
      }

      sourceMap.set(source, (sourceMap.get(source) || 0) + visits);

      if (u.utmCampaign) {
        const key = `${u.utmCampaign}:${source}`;
        const existing = campaignMap.get(key) || { campaign: u.utmCampaign, source, visits: 0 };
        existing.visits += visits;
        campaignMap.set(key, existing);
      }
    }

    const acquisition: AcquisitionIntelligenceDto = {
      sources: Array.from(sourceMap.entries()).map(([source, visits]) => ({
        source,
        visits,
      })),
      topCampaigns: Array.from(campaignMap.values())
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10),
      directVisits,
      campaignVisits,
    };

    // ==========================================
    // 3. UTILITY INTELLIGENCE
    // ==========================================
    const utilityDataMap = new Map<
      string,
      {
        pageViews: number;
        toolStarts: number;
        toolCompletions: number;
        toolErrors: number;
        resultDownloads: number;
      }
    >();

    for (const item of eventsByUtilityAndType) {
      if (!item.utilitySlug) continue;
      const data = utilityDataMap.get(item.utilitySlug) || {
        pageViews: 0,
        toolStarts: 0,
        toolCompletions: 0,
        toolErrors: 0,
        resultDownloads: 0,
      };

      if (item.eventType === 'PAGE_VIEW') data.pageViews += item._count._all;
      if (item.eventType === 'TOOL_START') data.toolStarts += item._count._all;
      if (item.eventType === 'TOOL_COMPLETE') data.toolCompletions += item._count._all;
      if (item.eventType === 'TOOL_ERROR') data.toolErrors += item._count._all;
      if (item.eventType === 'RESULT_DOWNLOAD') data.resultDownloads += item._count._all;

      utilityDataMap.set(item.utilitySlug, data);
    }

    const utilityMetaMap = new Map<string, { name: string; categorySlug?: string }>();
    for (const u of activeUtilities) {
      utilityMetaMap.set(u.slug, { name: u.name, categorySlug: u.category?.slug });
    }

    // Merge catalog utilities with tracked events
    const allSlugs = new Set<string>([...utilityMetaMap.keys(), ...utilityDataMap.keys()]);
    const utilities: UtilityIntelligenceDto[] = Array.from(allSlugs).map((slug) => {
      const data = utilityDataMap.get(slug) || {
        pageViews: 0,
        toolStarts: 0,
        toolCompletions: 0,
        toolErrors: 0,
        resultDownloads: 0,
      };
      const meta = utilityMetaMap.get(slug);

      const completionRate =
        data.toolStarts > 0
          ? Math.round((data.toolCompletions / data.toolStarts) * 1000) / 10
          : data.toolCompletions > 0
            ? 100
            : 0;
      const errorRate =
        data.toolStarts > 0 ? Math.round((data.toolErrors / data.toolStarts) * 1000) / 10 : 0;
      const downloadRate =
        data.toolCompletions > 0
          ? Math.round((data.resultDownloads / data.toolCompletions) * 1000) / 10
          : 0;

      return {
        utilitySlug: slug,
        name: meta?.name || slug,
        categorySlug: meta?.categorySlug,
        pageViews: data.pageViews,
        toolStarts: data.toolStarts,
        toolCompletions: data.toolCompletions,
        toolErrors: data.toolErrors,
        resultDownloads: data.resultDownloads,
        completionRate,
        errorRate,
        downloadRate,
      };
    });

    // Sort by most active (pageViews + toolStarts)
    utilities.sort((a, b) => b.pageViews + b.toolStarts - (a.pageViews + a.toolStarts));

    // ==========================================
    // 4. AD MONETIZATION INTELLIGENCE
    // ==========================================
    const impByPlacementMap = new Map<string, number>();
    for (const imp of impressionsByPlacement) {
      impByPlacementMap.set(imp.placementId, imp._count._all);
    }
    const clickByPlacementMap = new Map<string, number>();
    for (const clk of clicksByPlacement) {
      clickByPlacementMap.set(clk.placementId, clk._count._all);
    }

    const placementPerformance: PlacementPerformanceDto[] = placements.map((p) => {
      const imps = impByPlacementMap.get(p.id) || 0;
      const clks = clickByPlacementMap.get(p.id) || 0;
      const ctr = imps > 0 ? Math.round((clks / imps) * 10000) / 100 : 0.0;
      return {
        placementCode: p.code,
        name: p.name,
        impressions: imps,
        clicks: clks,
        ctr,
      };
    });

    // Device performance
    const impByDeviceMap = new Map<string, number>();
    for (const imp of impressionsByDevice) {
      impByDeviceMap.set(imp.deviceType, imp._count._all);
    }
    const clickByDeviceMap = new Map<string, number>();
    for (const clk of clicksByDevice) {
      clickByDeviceMap.set(clk.deviceType, clk._count._all);
    }

    const allDevices = Array.from(new Set([...impByDeviceMap.keys(), ...clickByDeviceMap.keys()]));
    const devicePerformance = allDevices.map((device) => {
      const imps = impByDeviceMap.get(device) || 0;
      const clks = clickByDeviceMap.get(device) || 0;
      const ctr = imps > 0 ? Math.round((clks / imps) * 10000) / 100 : 0.0;
      return { device, impressions: imps, clicks: clks, ctr };
    });

    // Campaign performance
    const impByCampaignMap = new Map<string, number>();
    for (const imp of impressionsByCampaign) {
      impByCampaignMap.set(imp.campaignId, imp._count._all);
    }
    const clickByCampaignMap = new Map<string, number>();
    for (const clk of clicksByCampaign) {
      clickByCampaignMap.set(clk.campaignId, clk._count._all);
    }

    const campaignPerformance = campaigns.map((c) => {
      const imps = impByCampaignMap.get(c.id) || 0;
      const clks = clickByCampaignMap.get(c.id) || 0;
      const ctr = imps > 0 ? Math.round((clks / imps) * 10000) / 100 : 0.0;
      return { campaignId: c.id, name: c.name, impressions: imps, clicks: clks, ctr };
    });

    const overallCtr =
      totalImpressionCount > 0
        ? Math.round((totalClickCount / totalImpressionCount) * 10000) / 100
        : 0.0;

    const monetization: AdMonetizationIntelligenceDto = {
      totalImpressions: totalImpressionCount,
      totalClicks: totalClickCount,
      overallCtr,
      placementPerformance,
      devicePerformance,
      campaignPerformance,
    };

    // ==========================================
    // 5. EXPERIMENTATION RESULTS
    // ==========================================
    const experimentMap = new Map<string, Map<string, { exposures: number; conversions: number; completions: number; downloads: number; adClicks: number }>>();

    for (const exp of ACTIVE_EXPERIMENTS) {
      const variantMap = new Map();
      for (const v of exp.variants) {
        variantMap.set(v.id, { exposures: 0, conversions: 0, completions: 0, downloads: 0, adClicks: 0 });
      }
      experimentMap.set(exp.id, variantMap);
    }

    // Process raw exposure events
    for (const exposure of experimentExposures) {
      const meta = exposure.metadata as any;
      if (!meta || !meta.experimentId || !meta.variant) continue;
      const expEntry = experimentMap.get(meta.experimentId);
      if (!expEntry) continue;
      const variantEntry = expEntry.get(meta.variant);
      if (variantEntry) {
        variantEntry.exposures++;
        if (meta.converted) {
          variantEntry.conversions++;
        }
      }
    }

    const experiments: ExperimentResultDto[] = ACTIVE_EXPERIMENTS.map((exp) => {
      const variantMap = experimentMap.get(exp.id)!;
      let totalExposures = 0;
      let winningVariantId: string | undefined = undefined;
      let maxRate = -1;

      const variantMetrics: ExperimentVariantMetricDto[] = exp.variants.map((v) => {
        const stats = variantMap.get(v.id) || {
          exposures: 0,
          conversions: 0,
          completions: 0,
          downloads: 0,
          adClicks: 0,
        };
        totalExposures += stats.exposures;
        const conversionRate =
          stats.exposures > 0 ? Math.round((stats.conversions / stats.exposures) * 1000) / 10 : 0.0;

        if (stats.exposures >= 5 && conversionRate > maxRate) {
          maxRate = conversionRate;
          winningVariantId = v.id;
        }

        return {
          variantId: v.id,
          name: v.name,
          exposures: stats.exposures,
          conversions: stats.conversions,
          conversionRate,
          toolCompletions: stats.completions,
          resultDownloads: stats.downloads,
          adClicks: stats.adClicks,
        };
      });

      return {
        experimentId: exp.id,
        name: exp.name,
        status: exp.status,
        totalExposures,
        variants: variantMetrics,
        winningVariantId,
      };
    });

    // ==========================================
    // 6. DEVICE BREAKDOWN
    // ==========================================
    const totalDeviceImps = devicePerformance.reduce((sum, d) => sum + d.impressions, 0);
    const deviceBreakdown = devicePerformance.map((d) => ({
      device: d.device,
      count: d.impressions,
      percentage:
        totalDeviceImps > 0 ? Math.round((d.impressions / totalDeviceImps) * 1000) / 10 : 0,
    }));

    return {
      periodDays,
      funnel,
      acquisition,
      utilities,
      monetization,
      experiments,
      deviceBreakdown,
    };
  }
}
