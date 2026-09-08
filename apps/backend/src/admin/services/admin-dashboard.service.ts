import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminDashboardMetricsDto } from '@ad-utility/shared';
import { UtilityStatus, CampaignStatus } from '@prisma/client';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(): Promise<AdminDashboardMetricsDto> {
    const [
      totalUsers,
      totalUtilities,
      activeUtilities,
      totalCampaigns,
      activeCampaigns,
      totalCreatives,
      totalImpressions,
      totalClicks,
      analyticsAggregates,
      aiAggregates,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.utility.count(),
      this.prisma.utility.count({ where: { status: UtilityStatus.ACTIVE } }),
      this.prisma.adCampaign.count(),
      this.prisma.adCampaign.count({ where: { status: CampaignStatus.ACTIVE } }),
      this.prisma.adCreative.count(),
      this.prisma.adImpression.count(),
      this.prisma.adClick.count(),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        _count: { _all: true },
      }),
      this.prisma.aiRequest.aggregate({
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
    ]);

    let totalPageViews = 0;
    let toolStarts = 0;
    let toolCompletions = 0;

    for (const group of analyticsAggregates) {
      if (group.eventType === 'PAGE_VIEW') totalPageViews = group._count._all;
      if (group.eventType === 'TOOL_START') toolStarts = group._count._all;
      if (group.eventType === 'TOOL_COMPLETE') toolCompletions = group._count._all;
    }

    const toolCompletionRate = toolStarts > 0 ? Math.round((toolCompletions / toolStarts) * 1000) / 10 : 100;
    const adCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;

    return {
      totalUsers,
      activeUtilities,
      totalUtilities,
      activeCampaigns,
      totalCampaigns,
      activeCreatives: totalCreatives,
      totalCreatives,
      totalImpressions,
      totalClicks,
      adCtr,
      totalPageViews,
      toolStarts,
      toolCompletions,
      toolCompletionRate,
      totalAiRequests: aiAggregates._count._all || 0,
      totalAiTokens: aiAggregates._sum.totalTokens || 0,
      totalAiCostUsd: Math.round((aiAggregates._sum.estimatedCostUsd || 0) * 1000) / 1000,
    };
  }
}
