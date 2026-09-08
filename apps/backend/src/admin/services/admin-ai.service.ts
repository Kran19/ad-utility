import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAiService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(days: number = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [aggregates, byModel, byStatus, recentRequests] = await Promise.all([
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
    ]);

    const totalRequests = aggregates._count._all || 0;
    const avgLatencyMs = totalRequests > 0 ? Math.round((aggregates._sum.durationMs || 0) / totalRequests) : 0;

    return {
      periodDays: days,
      totalRequests,
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
}
