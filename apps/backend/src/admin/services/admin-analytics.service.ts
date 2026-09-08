import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(days: number = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      eventsByType,
      eventsByUtility,
      impressionsByDevice,
      utmSources,
      placements,
      impressionsByPlacement,
      clicksByPlacement,
      recentEvents,
    ] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['utilitySlug'],
        where: { timestamp: { gte: cutoff }, utilitySlug: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { utilitySlug: 'desc' } },
        take: 10,
      }),
      this.prisma.adImpression.groupBy({
        by: ['deviceType'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['utmSource', 'utmMedium', 'utmCampaign'],
        where: {
          timestamp: { gte: cutoff },
          utmSource: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { utmSource: 'desc' } },
        take: 10,
      }),
      this.prisma.adPlacement.findMany({
        select: { id: true, code: true, name: true },
      }),
      this.prisma.adImpression.groupBy({
        by: ['placementId'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      this.prisma.adClick.groupBy({
        by: ['placementId'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.findMany({
        where: { timestamp: { gte: cutoff } },
        orderBy: { timestamp: 'desc' },
        take: 50,
      }),
    ]);

    // 1. Calculate Conversion Funnel Metrics
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

    // 2. Calculate Placement Performance & Safe CTR
    const impMap = new Map<string, number>();
    for (const imp of impressionsByPlacement) {
      impMap.set(imp.placementId, imp._count._all);
    }
    const clickMap = new Map<string, number>();
    for (const clk of clicksByPlacement) {
      clickMap.set(clk.placementId, clk._count._all);
    }

    const placementPerformance = placements.map((p) => {
      const imps = impMap.get(p.id) || 0;
      const clks = clickMap.get(p.id) || 0;
      const ctr = imps > 0 ? Math.round((clks / imps) * 10000) / 100 : 0.0;
      return {
        placementCode: p.code,
        name: p.name,
        impressions: imps,
        clicks: clks,
        ctr,
      };
    });

    // 3. Format Acquisition Channels
    const acquisition = utmSources.map((u) => ({
      source: u.utmSource || 'direct',
      medium: u.utmMedium || undefined,
      campaign: u.utmCampaign || undefined,
      visits: u._count._all,
    }));

    return {
      periodDays: days,
      funnel: {
        pageViews,
        toolStarts,
        toolCompletions,
        resultDownloads,
        toolErrors,
        viewToStartRate,
        startToCompleteRate,
        completeToDownloadRate,
        overallConversionRate,
      },
      placementPerformance,
      acquisition,
      eventsByType: eventsByType.map((e) => ({ type: e.eventType, count: e._count._all })),
      eventsByUtility: eventsByUtility.map((e) => ({ utilitySlug: e.utilitySlug, count: e._count._all })),
      impressionsByDevice: impressionsByDevice.map((i) => ({ device: i.deviceType, count: i._count._all })),
      recentEvents,
    };
  }
}

