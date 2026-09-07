import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsValidationService } from './analytics-validation.service';
import { AnalyticsDeduplicationService } from './analytics-deduplication.service';
import {
  AnalyticsEventDto,
  AnalyticsSummaryDto,
  AnalyticsQueryDto,
  AnalyticsUtilityMetric,
} from '@ad-utility/shared';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: AnalyticsValidationService,
    private readonly deduplicator: AnalyticsDeduplicationService,
  ) {}

  /**
   * Ingest single or batch telemetry events asynchronously
   */
  async ingestEvents(rawEvents: any[]): Promise<{ received: number; accepted: number; duplicates: number }> {
    const validEvents: AnalyticsEventDto[] = [];
    let duplicates = 0;

    const eventList = Array.isArray(rawEvents) ? rawEvents.slice(0, 50) : [rawEvents];

    for (const raw of eventList) {
      try {
        const sanitized = this.validator.validateAndSanitizeEvent(raw);
        if (sanitized.eventId && this.deduplicator.isDuplicate(sanitized.eventId)) {
          duplicates++;
          continue;
        }
        validEvents.push(sanitized);
      } catch (err: any) {
        this.logger.warn(`Rejected invalid analytics event: ${err.message}`);
      }
    }

    if (validEvents.length > 0) {
      // Asynchronously persist to PostgreSQL in non-blocking manner
      this.prisma.analyticsEvent
        .createMany({
          data: validEvents.map((e) => ({
            eventType: e.eventType,
            utilitySlug: e.utilitySlug,
            placementCode: e.placementCode,
            creativeId: e.creativeId,
            sessionToken: e.sessionToken,
            anonymousId: e.anonymousId,
            utmSource: e.utmSource,
            utmMedium: e.utmMedium,
            utmCampaign: e.utmCampaign,
            utmContent: e.utmContent,
            utmTerm: e.utmTerm,
            metadata: e.metadata,
            timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
          })),
        })
        .catch((err) => {
          this.logger.warn(`Failed to persist analytics events to database (failing open): ${err.message}`);
        });
    }

    return {
      received: eventList.length,
      accepted: validEvents.length,
      duplicates,
    };
  }

  /**
   * Generate Aggregated Platform Telemetry Summary
   */
  async getSummary(query?: AnalyticsQueryDto): Promise<AnalyticsSummaryDto> {
    const whereClause: any = {};

    if (query?.utilitySlug) {
      whereClause.utilitySlug = query.utilitySlug.toLowerCase().trim();
    }
    if (query?.eventType) {
      whereClause.eventType = query.eventType.toUpperCase().trim();
    }
    if (query?.utmSource) {
      whereClause.utmSource = query.utmSource;
    }
    if (query?.startDate || query?.endDate) {
      whereClause.timestamp = {};
      if (query.startDate) whereClause.timestamp.gte = new Date(query.startDate);
      if (query.endDate) whereClause.timestamp.lte = new Date(query.endDate);
    }

    const events = await this.prisma.analyticsEvent.findMany({
      where: whereClause,
      select: {
        eventType: true,
        utilitySlug: true,
        sessionToken: true,
      },
    });

    const breakdownByEventType: Record<string, number> = {};
    const sessions = new Set<string>();
    const utilityMap = new Map<string, { pageViews: number; toolStarts: number; toolCompletions: number; toolErrors: number }>();

    for (const e of events) {
      // Event type count
      breakdownByEventType[e.eventType] = (breakdownByEventType[e.eventType] || 0) + 1;

      // Unique sessions
      if (e.sessionToken) {
        sessions.add(e.sessionToken);
      }

      // Utility breakdown
      if (e.utilitySlug) {
        const u = utilityMap.get(e.utilitySlug) || { pageViews: 0, toolStarts: 0, toolCompletions: 0, toolErrors: 0 };
        if (e.eventType === 'PAGE_VIEW') u.pageViews++;
        if (e.eventType === 'TOOL_START') u.toolStarts++;
        if (e.eventType === 'TOOL_COMPLETE') u.toolCompletions++;
        if (e.eventType === 'TOOL_ERROR') u.toolErrors++;
        utilityMap.set(e.utilitySlug, u);
      }
    }

    const totalEvents = events.length;
    const totalPageViews = breakdownByEventType['PAGE_VIEW'] || 0;
    const totalToolStarts = breakdownByEventType['TOOL_START'] || 0;
    const totalToolCompletions = breakdownByEventType['TOOL_COMPLETE'] || 0;
    const totalToolErrors = breakdownByEventType['TOOL_ERROR'] || 0;
    const toolCompletionRate = totalToolStarts > 0 ? parseFloat(((totalToolCompletions / totalToolStarts) * 100).toFixed(1)) : 100;

    // Cross-subsystem metrics from Ad & AI domains
    const totalAdImpressions = await this.prisma.adImpression.count();
    const totalAdClicks = await this.prisma.adClick.count();
    const adCtr = totalAdImpressions > 0 ? parseFloat(((totalAdClicks / totalAdImpressions) * 100).toFixed(2)) : 0.0;
    const totalAiRequests = await this.prisma.aiRequest.count();

    const breakdownByUtility: AnalyticsUtilityMetric[] = Array.from(utilityMap.entries()).map(([slug, data]) => ({
      utilitySlug: slug,
      pageViews: data.pageViews,
      toolStarts: data.toolStarts,
      toolCompletions: data.toolCompletions,
      toolErrors: data.toolErrors,
      completionRate: data.toolStarts > 0 ? parseFloat(((data.toolCompletions / data.toolStarts) * 100).toFixed(1)) : 100,
    }));

    return {
      totalEvents,
      totalPageViews,
      uniqueSessions: sessions.size,
      totalToolStarts,
      totalToolCompletions,
      totalToolErrors,
      toolCompletionRate,
      totalAdImpressions,
      totalAdClicks,
      adCtr,
      totalAiRequests,
      breakdownByUtility,
      breakdownByEventType,
    };
  }
}
