import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiGatewayService } from '../../ai/services/ai-gateway.service';

@Injectable()
export class AdminAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGatewayService: AiGatewayService,
  ) {}

  async getOverview(days: number = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [aggregates, byModel, byStatus, recentRequests, providerHealth] = await Promise.all([
      this.prisma.aiRequest.aggregate({
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          estimatedCostUsd: true,
          durationMs: true,
        },
      }),
      this.prisma.aiRequest.groupBy({
        by: ['model'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
      this.prisma.aiRequest.groupBy({
        by: ['status'],
        where: { timestamp: { gte: cutoff } },
        _count: { _all: true },
      }),
      this.prisma.aiRequest.findMany({
        where: { timestamp: { gte: cutoff } },
        orderBy: { timestamp: 'desc' },
        take: 50,
      }),
      this.aiGatewayService.getProviderHealth(),
    ]);

    const totalRequests = aggregates._count._all || 0;
    const avgLatencyMs = totalRequests > 0 ? Math.round((aggregates._sum.durationMs || 0) / totalRequests) : 0;

    let successfulRequests = 0;
    let failedRequests = 0;
    for (const s of byStatus) {
      if (s.status === 'SUCCESS') successfulRequests += s._count._all;
      else failedRequests += s._count._all;
    }

    return {
      periodDays: days,
      provider: providerHealth.provider,
      providerMode: providerHealth.providerMode.toUpperCase(),
      providerHealth,
      dailyBudgetUsd: providerHealth.dailyBudgetUsd,
      todaySpendUsd: providerHealth.todaySpendUsd,
      budgetStatus: providerHealth.budgetStatus,
      costType: 'ESTIMATED' as const,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalInputTokens: aggregates._sum.inputTokens || 0,
      totalOutputTokens: aggregates._sum.outputTokens || 0,
      totalTokens: aggregates._sum.totalTokens || 0,
      totalCostUsd: Math.round((aggregates._sum.estimatedCostUsd || 0) * 1000) / 1000,
      avgLatencyMs,
      byModel: byModel.map((m) => ({
        model: m.model,
        count: m._count._all,
        totalTokens: m._sum.totalTokens || 0,
        estimatedCostUsd: Math.round((m._sum.estimatedCostUsd || 0) * 1000) / 1000,
      })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      recentRequests,
    };
  }

  async getProviderHealth() {
    return this.aiGatewayService.getProviderHealth();
  }
}
