import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisAdCacheService } from '../../ads/services/redis-ad-cache.service';
import { GrowthIntelligenceService } from './growth-intelligence.service';
import { MonetizationIntelligenceService } from './monetization-intelligence.service';
import {
  JourneyIntelligenceDto,
  JourneyQualityScoreDto,
  RetentionHealthDto,
  ReturningVisitorMetricsDto,
  RetentionMetricsDto,
  RetentionCohortDto,
  SessionDepthDto,
  CrossUtilityFlowDto,
  AcquisitionRetentionDto,
  DeviceRetentionDto,
  ExperimentJourneyImpactDto,
  JourneyOpportunityDto,
} from '@ad-utility/shared';

const MINIMUM_SAMPLE_SIZE = 5;
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class JourneyIntelligenceService {
  private readonly logger = new Logger(JourneyIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisAdCacheService,
    private readonly growthService: GrowthIntelligenceService,
    private readonly monetizationService: MonetizationIntelligenceService,
  ) {}

  /**
   * Main aggregator for Journey and Retention Intelligence
   */
  async getJourneyIntelligence(days: number = 30): Promise<JourneyIntelligenceDto> {
    const periodDays = Math.max(1, Math.min(days, 365));
    const cacheKey = `admin:journey:summary:${periodDays}`;

    // 1. Attempt Redis Cache Lookup (Fail-Open)
    try {
      const cached = await this.redisCache.getJson<JourneyIntelligenceDto>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err: any) {
      this.logger.warn(`Redis cache read failed for journey intelligence: ${err?.message || err}`);
    }

    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // 2. Fetch required aggregate datasets in parallel
    const [
      growthData,
      monetizationData,
      allEvents,
      activeUtilities,
    ] = await Promise.all([
      this.growthService.getGrowthIntelligence(periodDays),
      this.monetizationService.getMonetizationIntelligence(periodDays),
      this.prisma.analyticsEvent.findMany({
        where: {
          timestamp: { gte: cutoff },
          sessionToken: { not: null },
        },
        select: {
          sessionToken: true,
          eventType: true,
          utilitySlug: true,
          utmSource: true,
          metadata: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'asc' },
        take: 10000, // Safe bounded cap
      }),
      this.prisma.utility.findMany({
        where: { status: 'ACTIVE' },
        select: { slug: true, name: true },
      }),
    ]);

    const utilityNameMap = new Map<string, string>(
      activeUtilities.map((u) => [u.slug, u.name]),
    );

    // 3. Process Anonymous Sessions
    const sessionsByToken = new Map<
      string,
      {
        token: string;
        firstSeen: Date;
        lastSeen: Date;
        events: Array<{ eventType: string; utilitySlug: string | null; timestamp: Date }>;
        utilities: Set<string>;
        utmSource?: string;
        device?: string;
        hasCompleted: boolean;
        hasDownloaded: boolean;
        hasError: boolean;
      }
    >();

    for (const evt of allEvents) {
      if (!evt.sessionToken) continue;
      const token = evt.sessionToken;
      const meta = evt.metadata as Record<string, any> | null;
      const device = meta?.device ? String(meta.device).toLowerCase() : 'desktop';

      let session = sessionsByToken.get(token);
      if (!session) {
        session = {
          token,
          firstSeen: evt.timestamp,
          lastSeen: evt.timestamp,
          events: [],
          utilities: new Set<string>(),
          utmSource: evt.utmSource || 'direct',
          device,
          hasCompleted: false,
          hasDownloaded: false,
          hasError: false,
        };
        sessionsByToken.set(token, session);
      }

      session.lastSeen = evt.timestamp;
      session.events.push({
        eventType: evt.eventType,
        utilitySlug: evt.utilitySlug,
        timestamp: evt.timestamp,
      });

      if (evt.utilitySlug) {
        session.utilities.add(evt.utilitySlug);
      }
      if (evt.eventType === 'TOOL_COMPLETE') session.hasCompleted = true;
      if (evt.eventType === 'RESULT_DOWNLOAD') session.hasDownloaded = true;
      if (evt.eventType === 'TOOL_ERROR') session.hasError = true;
    }

    const totalSessions = sessionsByToken.size;

    // 4. Calculate Returning Visitor & Multi-Utility Metrics
    let returningSessionCount = 0;
    let firstSessionCount = 0;
    let multiUtilitySessionCount = 0;
    let totalUtilitiesUsedAcrossSessions = 0;

    for (const s of sessionsByToken.values()) {
      const durationMs = s.lastSeen.getTime() - s.firstSeen.getTime();
      const isReturning = durationMs > 30 * 60 * 1000 || s.events.length >= 4;
      if (isReturning) {
        returningSessionCount++;
      } else {
        firstSessionCount++;
      }

      if (s.utilities.size >= 2) {
        multiUtilitySessionCount++;
      }
      totalUtilitiesUsedAcrossSessions += s.utilities.size;
    }

    const returningVisitorRate =
      totalSessions > 0
        ? Number(((returningSessionCount / totalSessions) * 100).toFixed(2))
        : 0;
    const multiUtilityRate =
      totalSessions > 0
        ? Number(((multiUtilitySessionCount / totalSessions) * 100).toFixed(2))
        : 0;
    const avgUtilitiesPerSession =
      totalSessions > 0
        ? Number((totalUtilitiesUsedAcrossSessions / totalSessions).toFixed(2))
        : 0;

    const returningVisitors: ReturningVisitorMetricsDto = {
      firstSessionVolume: firstSessionCount,
      returningSessionVolume: returningSessionCount,
      returnRate: returningVisitorRate,
      avgUtilitiesPerSession,
      multiUtilityRate,
    };

    // 5. Calculate Retention Cohorts (D1, D7, D14, D30)
    const cohortsByDate = new Map<
      string,
      {
        cohortDate: string;
        tokens: Set<string>;
        d1Returning: number;
        d7Returning: number;
        d14Returning: number;
        d30Returning: number;
      }
    >();

    for (const s of sessionsByToken.values()) {
      const dateStr = s.firstSeen.toISOString().slice(0, 10);
      let cohort = cohortsByDate.get(dateStr);
      if (!cohort) {
        cohort = {
          cohortDate: dateStr,
          tokens: new Set<string>(),
          d1Returning: 0,
          d7Returning: 0,
          d14Returning: 0,
          d30Returning: 0,
        };
        cohortsByDate.set(dateStr, cohort);
      }
      cohort.tokens.add(s.token);

      const daysElapsed = (s.lastSeen.getTime() - s.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
      if (daysElapsed >= 1) cohort.d1Returning++;
      if (daysElapsed >= 7) cohort.d7Returning++;
      if (daysElapsed >= 14) cohort.d14Returning++;
      if (daysElapsed >= 30) cohort.d30Returning++;
    }

    const retentionCohorts: RetentionCohortDto[] = Array.from(cohortsByDate.values())
      .map((c) => {
        const size = c.tokens.size;
        const d1Rate = size > 0 ? Number(((c.d1Returning / size) * 100).toFixed(1)) : 0;
        const d7Rate = size > 0 ? Number(((c.d7Returning / size) * 100).toFixed(1)) : 0;
        const d14Rate = size > 0 ? Number(((c.d14Returning / size) * 100).toFixed(1)) : 0;
        const d30Rate = size > 0 ? Number(((c.d30Returning / size) * 100).toFixed(1)) : 0;
        const status: 'MATURE' | 'INSUFFICIENT_DATA' | 'PENDING' =
          size < MINIMUM_SAMPLE_SIZE ? 'INSUFFICIENT_DATA' : 'MATURE';

        return {
          cohortDate: c.cohortDate,
          cohortSize: size,
          d1Returning: c.d1Returning,
          d1RetentionRate: d1Rate,
          d7Returning: c.d7Returning,
          d7RetentionRate: d7Rate,
          d14Returning: c.d14Returning,
          d14RetentionRate: d14Rate,
          d30Returning: c.d30Returning,
          d30RetentionRate: d30Rate,
          status,
        };
      })
      .sort((a, b) => b.cohortDate.localeCompare(a.cohortDate))
      .slice(0, 14); // Bounded top 14 daily cohorts

    // Summary retention across all cohorts
    let sumD1 = 0;
    let sumD7 = 0;
    let sumD30 = 0;
    let totalCohortTokens = 0;
    for (const c of retentionCohorts) {
      sumD1 += c.d1Returning;
      sumD7 += c.d7Returning;
      sumD30 += c.d30Returning;
      totalCohortTokens += c.cohortSize;
    }

    const overallD1 =
      totalCohortTokens > 0
        ? Number(((sumD1 / totalCohortTokens) * 100).toFixed(1))
        : 0;
    const overallD7 =
      totalCohortTokens > 0
        ? Number(((sumD7 / totalCohortTokens) * 100).toFixed(1))
        : 0;
    const overallD30 =
      totalCohortTokens > 0
        ? Number(((sumD30 / totalCohortTokens) * 100).toFixed(1))
        : 0;

    const retentionSummary: RetentionMetricsDto = {
      totalUniqueTokens: totalSessions,
      firstVisitSessions: firstSessionCount,
      returningSessions: returningSessionCount,
      returningVisitorRate,
      avgSessionsPerToken: 1.0,
      avgUtilitiesPerToken: avgUtilitiesPerSession,
      overallD1RetentionRate: overallD1,
      overallD7RetentionRate: overallD7,
      overallD30RetentionRate: overallD30,
      retentionMaturityStatus:
        totalSessions < MINIMUM_SAMPLE_SIZE ? 'INSUFFICIENT_DATA' : 'MATURE',
    };

    // 6. Calculate Session Depth Intelligence
    const depthBuckets: Record<
      '1 utility' | '2 utilities' | '3 utilities' | '4+ utilities',
      { sessions: number; completions: number; downloads: number; adImpressions: number; adClicks: number }
    > = {
      '1 utility': { sessions: 0, completions: 0, downloads: 0, adImpressions: 0, adClicks: 0 },
      '2 utilities': { sessions: 0, completions: 0, downloads: 0, adImpressions: 0, adClicks: 0 },
      '3 utilities': { sessions: 0, completions: 0, downloads: 0, adImpressions: 0, adClicks: 0 },
      '4+ utilities': { sessions: 0, completions: 0, downloads: 0, adImpressions: 0, adClicks: 0 },
    };

    for (const s of sessionsByToken.values()) {
      const uCount = s.utilities.size;
      let bucketKey: '1 utility' | '2 utilities' | '3 utilities' | '4+ utilities';
      if (uCount <= 1) bucketKey = '1 utility';
      else if (uCount === 2) bucketKey = '2 utilities';
      else if (uCount === 3) bucketKey = '3 utilities';
      else bucketKey = '4+ utilities';

      depthBuckets[bucketKey].sessions++;
      if (s.hasCompleted) depthBuckets[bucketKey].completions++;
      if (s.hasDownloaded) depthBuckets[bucketKey].downloads++;

      // Count ad exposure within this session
      for (const e of s.events) {
        if (e.eventType === 'AD_IMPRESSION') depthBuckets[bucketKey].adImpressions++;
        if (e.eventType === 'AD_CLICK') depthBuckets[bucketKey].adClicks++;
      }
    }

    const sessionDepth: SessionDepthDto[] = (
      ['1 utility', '2 utilities', '3 utilities', '4+ utilities'] as const
    ).map((cat) => {
      const b = depthBuckets[cat];
      const pct = totalSessions > 0 ? Number(((b.sessions / totalSessions) * 100).toFixed(1)) : 0;
      const compRate = b.sessions > 0 ? Number(((b.completions / b.sessions) * 100).toFixed(1)) : 0;
      const dlRate = b.sessions > 0 ? Number(((b.downloads / b.sessions) * 100).toFixed(1)) : 0;
      const ctr = b.adImpressions > 0 ? Number(((b.adClicks / b.adImpressions) * 100).toFixed(2)) : 0;

      return {
        depthCategory: cat,
        sessionCount: b.sessions,
        percentageOfSessions: pct,
        toolCompletions: b.completions,
        completionRate: compRate,
        resultDownloads: b.downloads,
        downloadRate: dlRate,
        adImpressions: b.adImpressions,
        adClicks: b.adClicks,
        adCtr: ctr,
      };
    });

    // 7. Calculate Cross-Utility Flow Transitions (Top 20 bounded)
    const transitionCounts = new Map<
      string,
      { source: string; target: string; count: number; completions: number; downloads: number }
    >();
    const utilitySourceTotals = new Map<string, number>();

    for (const s of sessionsByToken.values()) {
      const orderedEvents = s.events.filter((e) => e.utilitySlug);
      const visitedInOrder: string[] = [];
      for (const e of orderedEvents) {
        if (e.utilitySlug && visitedInOrder[visitedInOrder.length - 1] !== e.utilitySlug) {
          visitedInOrder.push(e.utilitySlug);
        }
      }

      for (let i = 0; i < visitedInOrder.length - 1; i++) {
        const source = visitedInOrder[i];
        const target = visitedInOrder[i + 1];
        utilitySourceTotals.set(source, (utilitySourceTotals.get(source) || 0) + 1);

        const key = `${source}->${target}`;
        let tr = transitionCounts.get(key);
        if (!tr) {
          tr = { source, target, count: 0, completions: 0, downloads: 0 };
          transitionCounts.set(key, tr);
        }
        tr.count++;
        if (s.hasCompleted) tr.completions++;
        if (s.hasDownloaded) tr.downloads++;
      }
    }

    const crossUtilityFlows: CrossUtilityFlowDto[] = Array.from(transitionCounts.values())
      .map((t) => {
        const sourceTotal = utilitySourceTotals.get(t.source) || t.count;
        const trRate = sourceTotal > 0 ? Number(((t.count / sourceTotal) * 100).toFixed(1)) : 0;
        const compRate = t.count > 0 ? Number(((t.completions / t.count) * 100).toFixed(1)) : 0;
        const dlRate = t.count > 0 ? Number(((t.downloads / t.count) * 100).toFixed(1)) : 0;

        return {
          sourceUtilitySlug: t.source,
          targetUtilitySlug: t.target,
          sourceUtilityName: utilityNameMap.get(t.source) || t.source,
          targetUtilityName: utilityNameMap.get(t.target) || t.target,
          transitionCount: t.count,
          transitionRate: trRate,
          targetCompletionRate: compRate,
          targetDownloadRate: dlRate,
        };
      })
      .sort((a, b) => b.transitionCount - a.transitionCount)
      .slice(0, 20); // Top 20 bounded

    // 8. Acquisition Retention Analysis
    const sourceMap = new Map<
      string,
      { visitors: number; returning: number; d1: number; d7: number; d30: number; completed: number }
    >();

    for (const s of sessionsByToken.values()) {
      const src = s.utmSource || 'direct';
      let entry = sourceMap.get(src);
      if (!entry) {
        entry = { visitors: 0, returning: 0, d1: 0, d7: 0, d30: 0, completed: 0 };
        sourceMap.set(src, entry);
      }
      entry.visitors++;
      const duration = (s.lastSeen.getTime() - s.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
      if (duration > 0.02) entry.returning++;
      if (duration >= 1) entry.d1++;
      if (duration >= 7) entry.d7++;
      if (duration >= 30) entry.d30++;
      if (s.hasCompleted) entry.completed++;
    }

    const acquisitionRetention: AcquisitionRetentionDto[] = Array.from(sourceMap.entries())
      .map(([src, d]) => {
        const retRate = d.visitors > 0 ? Number(((d.returning / d.visitors) * 100).toFixed(1)) : 0;
        const d1Rate = d.visitors > 0 ? Number(((d.d1 / d.visitors) * 100).toFixed(1)) : 0;
        const d7Rate = d.visitors > 0 ? Number(((d.d7 / d.visitors) * 100).toFixed(1)) : 0;
        const d30Rate = d.visitors > 0 ? Number(((d.d30 / d.visitors) * 100).toFixed(1)) : 0;
        const compRate = d.visitors > 0 ? (d.completed / d.visitors) * 100 : 0;
        const qScore = Math.min(100, Math.round(compRate * 0.5 + retRate * 0.3 + d1Rate * 0.2));

        return {
          source: src,
          visitors: d.visitors,
          returningSessions: d.returning,
          returnRate: retRate,
          d1Rate,
          d7Rate,
          d30Rate,
          journeyQualityScore: qScore,
        };
      })
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 10);

    // 9. Device Retention Analysis
    const deviceMap = new Map<
      string,
      { count: number; returning: number; completed: number; downloaded: number; d1: number; d7: number }
    >();

    for (const s of sessionsByToken.values()) {
      const dev = s.device || 'desktop';
      let entry = deviceMap.get(dev);
      if (!entry) {
        entry = { count: 0, returning: 0, completed: 0, downloaded: 0, d1: 0, d7: 0 };
        deviceMap.set(dev, entry);
      }
      entry.count++;
      const duration = (s.lastSeen.getTime() - s.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
      if (duration > 0.02) entry.returning++;
      if (s.hasCompleted) entry.completed++;
      if (s.hasDownloaded) entry.downloaded++;
      if (duration >= 1) entry.d1++;
      if (duration >= 7) entry.d7++;
    }

    const deviceRetention: DeviceRetentionDto[] = Array.from(deviceMap.entries()).map(
      ([dev, d]) => {
        const retRate = d.count > 0 ? Number(((d.returning / d.count) * 100).toFixed(1)) : 0;
        const compRate = d.count > 0 ? Number(((d.completed / d.count) * 100).toFixed(1)) : 0;
        const dlRate = d.count > 0 ? Number(((d.downloaded / d.count) * 100).toFixed(1)) : 0;
        const d1Rate = d.count > 0 ? Number(((d.d1 / d.count) * 100).toFixed(1)) : 0;
        const d7Rate = d.count > 0 ? Number(((d.d7 / d.count) * 100).toFixed(1)) : 0;

        return {
          device: dev.toUpperCase(),
          sessionCount: d.count,
          returnRate: retRate,
          completionRate: compRate,
          downloadRate: dlRate,
          d1Rate,
          d7Rate,
        };
      },
    );

    // 10. Experiment Journey Impact
    const registeredExperiments = this.growthService.getRegisteredExperiments();
    const experimentImpacts: ExperimentJourneyImpactDto[] = [];

    for (const exp of registeredExperiments) {
      for (const v of exp.variants) {
        const expResult = growthData.experiments.find((e) => e.experimentId === exp.id);
        const vMetric = expResult?.variants.find((vr) => vr.variantId === v.id);
        const exposures = vMetric?.exposures || 0;
        const conversions = vMetric?.conversions || 0;
        const compRate = exposures > 0 ? Number(((conversions / exposures) * 100).toFixed(1)) : 0;

        const sampleStatus: 'SUFFICIENT' | 'INSUFFICIENT_DATA' =
          exposures >= MINIMUM_SAMPLE_SIZE ? 'SUFFICIENT' : 'INSUFFICIENT_DATA';

        let observedImpact =
          'Observed variant trajectory is consistent with platform baseline.';
        if (sampleStatus === 'INSUFFICIENT_DATA') {
          observedImpact =
            'Sample volume is insufficient to draw journey associations.';
        } else if (compRate > 50) {
          observedImpact =
            'Variant is associated with above-average task completion in the observed period.';
        }

        experimentImpacts.push({
          experimentId: exp.id,
          experimentName: exp.name,
          variantId: v.id,
          variantName: v.name,
          exposures,
          returnRate: returningVisitorRate,
          completionRate: compRate,
          multiUtilityRate,
          observedImpact,
          sampleStatus,
        });
      }
    }

    // 11. Deterministic Journey Quality Score (0–100)
    const funnel = growthData.funnel;
    const completionRate = funnel.startToCompleteRate || 0;
    const downloadRate = funnel.completeToDownloadRate || 0;
    const errorRate = funnel.pageViews > 0 ? (funnel.toolErrors / funnel.pageViews) * 100 : 0;

    let journeyScore = 0;
    let journeyRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_ATTENTION' | 'INSUFFICIENT_DATA' =
      'INSUFFICIENT_DATA';

    const completionWeight = 35;
    const downloadWeight = 25;
    const multiUtilityWeight = 20;
    const returnWeight = 15;
    const errorWeight = 5;

    const compScore = (completionRate / 100) * completionWeight;
    const dlScore = (downloadRate / 100) * downloadWeight;
    const muScore = (multiUtilityRate / 100) * multiUtilityWeight;
    const retScore = (returningVisitorRate / 100) * returnWeight;
    const errScore = Math.max(0, (1 - errorRate / 100)) * errorWeight;

    if (totalSessions >= MINIMUM_SAMPLE_SIZE) {
      journeyScore = Math.min(100, Math.round(compScore + dlScore + muScore + retScore + errScore));
      if (journeyScore >= 80) journeyRating = 'EXCELLENT';
      else if (journeyScore >= 60) journeyRating = 'GOOD';
      else if (journeyScore >= 40) journeyRating = 'FAIR';
      else journeyRating = 'NEEDS_ATTENTION';
    }

    const journeyQuality: JourneyQualityScoreDto = {
      score: journeyScore,
      rating: journeyRating,
      components: {
        completionWeight,
        completionScore: Number(compScore.toFixed(1)),
        downloadWeight,
        downloadScore: Number(dlScore.toFixed(1)),
        multiUtilityWeight,
        multiUtilityScore: Number(muScore.toFixed(1)),
        returnWeight,
        returnScore: Number(retScore.toFixed(1)),
        errorWeight,
        errorScore: Number(errScore.toFixed(1)),
      },
      explanation:
        totalSessions < MINIMUM_SAMPLE_SIZE
          ? 'Insufficient telemetry data to compute a statistically meaningful Journey Quality Score.'
          : `Deterministic score (${journeyScore}/100) based on task completion (${completionRate}%), export rate (${downloadRate}%), multi-tool progression (${multiUtilityRate}%), and anonymous return rate (${returningVisitorRate}%).`,
    };

    // 12. Deterministic Retention Health Score (0–100)
    let retHealthScore = 0;
    let retHealthStatus: 'HEALTHY' | 'MODERATE' | 'NEEDS_ATTENTION' | 'INSUFFICIENT_DATA' =
      'INSUFFICIENT_DATA';

    if (totalSessions >= MINIMUM_SAMPLE_SIZE) {
      const d1Comp = (overallD1 / 100) * 35;
      const d7Comp = (overallD7 / 100) * 30;
      const retComp = (returningVisitorRate / 100) * 20;
      const muProgComp = (multiUtilityRate / 100) * 15;

      retHealthScore = Math.min(100, Math.round(d1Comp + d7Comp + retComp + muProgComp));
      if (retHealthScore >= 70) retHealthStatus = 'HEALTHY';
      else if (retHealthScore >= 40) retHealthStatus = 'MODERATE';
      else retHealthStatus = 'NEEDS_ATTENTION';
    }

    const retentionHealth: RetentionHealthDto = {
      score: retHealthScore,
      status: retHealthStatus,
      d1RetentionRate: overallD1,
      d7RetentionRate: overallD7,
      returnVisitorRate: returningVisitorRate,
      multiSessionProgressionRate: multiUtilityRate,
      explanation:
        totalSessions < MINIMUM_SAMPLE_SIZE
          ? 'Insufficient historical session cohort data.'
          : `Retention Health Index (${retHealthScore}/100) reflecting D1 retention (${overallD1}%), D7 retention (${overallD7}%), and repeat session frequency.`,
    };

    // 13. Generate Prioritized Advisory Opportunities
    const opportunities = this.generateJourneyOpportunities({
      totalSessions,
      returningVisitorRate,
      multiUtilityRate,
      completionRate,
      crossUtilityFlows,
      acquisitionRetention,
      experimentImpacts,
    });

    const result: JourneyIntelligenceDto = {
      periodDays,
      journeyQuality,
      retentionHealth,
      returningVisitors,
      retentionSummary,
      retentionCohorts,
      sessionDepth,
      crossUtilityFlows,
      acquisitionRetention,
      deviceRetention,
      experimentImpacts,
      opportunities,
    };

    // 14. Cache Result in Redis (Fail-Open)
    try {
      await this.redisCache.setJson(cacheKey, result, CACHE_TTL_SECONDS);
    } catch (err: any) {
      this.logger.warn(`Redis cache set failed for journey intelligence: ${err?.message || err}`);
    }

    return result;
  }

  /**
   * Return advisory journey opportunities
   */
  async getOpportunities(days: number = 30): Promise<JourneyOpportunityDto[]> {
    const data = await this.getJourneyIntelligence(days);
    return data.opportunities;
  }

  /**
   * Deterministic advisory opportunities generator
   */
  private generateJourneyOpportunities(context: {
    totalSessions: number;
    returningVisitorRate: number;
    multiUtilityRate: number;
    completionRate: number;
    crossUtilityFlows: CrossUtilityFlowDto[];
    acquisitionRetention: AcquisitionRetentionDto[];
    experimentImpacts: ExperimentJourneyImpactDto[];
  }): JourneyOpportunityDto[] {
    const opps: JourneyOpportunityDto[] = [];
    const {
      totalSessions,
      returningVisitorRate,
      multiUtilityRate,
      completionRate,
      crossUtilityFlows,
      acquisitionRetention,
      experimentImpacts,
    } = context;

    if (totalSessions < MINIMUM_SAMPLE_SIZE) {
      opps.push({
        id: 'opp_journey_sample_low',
        area: 'RETENTION',
        severity: 'INFO',
        entity: 'Global Platform',
        reason: 'Telemetry dataset contains fewer than minimum required session units.',
        metric: 'Total Sessions',
        currentValue: `${totalSessions}`,
        recommendedAction: 'Continue observing traffic to build statistically significant cohort baselines.',
        confidenceLevel: 'INSUFFICIENT_DATA',
      });
      return opps;
    }

    // 1. Cross-Utility Transition Opportunities
    if (multiUtilityRate < 15) {
      opps.push({
        id: 'opp_journey_multi_tool_low',
        area: 'CROSS_UTILITY',
        severity: 'HIGH',
        entity: 'Related Utilities Widget',
        reason: 'Most visitors use only a single tool and exit without exploring related capabilities.',
        metric: 'Multi-Utility Session Rate',
        currentValue: `${multiUtilityRate}%`,
        recommendedAction: 'Enhance contextual utility recommendations and post-execution next-step CTA links.',
        confidenceLevel: 'HIGH',
      });
    }

    // 2. High-Converting Transition Highlight
    if (crossUtilityFlows.length > 0) {
      const topFlow = crossUtilityFlows[0];
      if (topFlow.transitionCount >= 3) {
        opps.push({
          id: `opp_flow_${topFlow.sourceUtilitySlug}_to_${topFlow.targetUtilitySlug}`,
          area: 'CROSS_UTILITY',
          severity: 'MEDIUM',
          entity: `${topFlow.sourceUtilityName} → ${topFlow.targetUtilityName}`,
          reason: 'Strong observed pathway between these two utilities.',
          metric: 'Transition Rate',
          currentValue: `${topFlow.transitionRate}%`,
          recommendedAction: `Promote direct workflow linkage from ${topFlow.sourceUtilityName} to ${topFlow.targetUtilityName}.`,
          confidenceLevel: 'HIGH',
        });
      }
    }

    // 3. Acquisition Retention Disparity
    for (const acq of acquisitionRetention) {
      if (acq.visitors >= MINIMUM_SAMPLE_SIZE && acq.returnRate < 5) {
        opps.push({
          id: `opp_acq_low_retention_${acq.source}`,
          area: 'ACQUISITION',
          severity: 'MEDIUM',
          entity: `Traffic Source: ${acq.source}`,
          reason: 'Acquisition channel produces immediate utility usage but low observed return rate.',
          metric: 'Observed Return Rate',
          currentValue: `${acq.returnRate}%`,
          recommendedAction: 'Review landing page relevance and encourage bookmarking or multi-step utility workflows.',
          confidenceLevel: 'MEDIUM',
        });
      }
    }

    // 4. Returning Visitor Opportunity
    if (returningVisitorRate < 20) {
      opps.push({
        id: 'opp_retention_repeat_sessions',
        area: 'RETENTION',
        severity: 'MEDIUM',
        entity: 'Anonymous Retention',
        reason: 'Observed returning visitor proportion is below 20%.',
        metric: 'Return Visitor Rate',
        currentValue: `${returningVisitorRate}%`,
        recommendedAction: 'Introduce recent tool history or quick-relaunch shortcuts in the navigation header.',
        confidenceLevel: 'HIGH',
      });
    }

    // 5. Experiment Journey Insight
    for (const exp of experimentImpacts) {
      if (exp.sampleStatus === 'SUFFICIENT' && exp.completionRate > completionRate + 10) {
        opps.push({
          id: `opp_exp_variant_${exp.experimentId}_${exp.variantId}`,
          area: 'EXPERIMENT',
          severity: 'LOW',
          entity: `Experiment ${exp.experimentName} (${exp.variantName})`,
          reason: 'Variant is associated with observed above-average completion rate.',
          metric: 'Variant Completion Rate',
          currentValue: `${exp.completionRate}%`,
          recommendedAction: 'Consider prioritizing this variant in the next experiment cycle.',
          confidenceLevel: 'MEDIUM',
        });
      }
    }

    return opps;
  }
}
