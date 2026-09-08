/**
 * Canonical Analytics Event Types
 */
export type AnalyticsEventType =
  | 'PAGE_VIEW'
  | 'TOOL_START'
  | 'TOOL_COMPLETE'
  | 'TOOL_ERROR'
  | 'RESULT_DOWNLOAD'
  | 'AD_IMPRESSION'
  | 'AD_CLICK'
  | 'AI_REQUEST'
  | 'EXPERIMENT_EXPOSURE';

/**
 * Standard Analytics Event Payload
 */
export interface AnalyticsEventDto {
  eventId?: string;
  eventType: AnalyticsEventType;
  utilitySlug?: string;
  placementCode?: string;
  creativeId?: string;
  sessionToken?: string;
  anonymousId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

/**
 * Batch Event Ingestion Payload
 */
export interface AnalyticsBatchIngestionDto {
  events: AnalyticsEventDto[];
}

/**
 * Query Filter for Reporting
 */
export interface AnalyticsQueryDto {
  startDate?: string;
  endDate?: string;
  utilitySlug?: string;
  eventType?: AnalyticsEventType;
  utmSource?: string;
  utmCampaign?: string;
}

/**
 * Aggregated Metrics Breakdown
 */
export interface AnalyticsUtilityMetric {
  utilitySlug: string;
  pageViews: number;
  toolStarts: number;
  toolCompletions: number;
  toolErrors: number;
  resultDownloads?: number;
  completionRate: number;
}

/**
 * Funnel Stage Metric with Drop-off
 */
export interface FunnelStageMetricDto {
  stage: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
}

/**
 * Funnel Stage Conversion Telemetry
 */
export interface FunnelMetricsDto {
  pageViews: number;
  toolStarts: number;
  toolCompletions: number;
  resultDownloads: number;
  toolErrors: number;
  viewToStartRate: number;
  startToCompleteRate: number;
  completeToDownloadRate: number;
  overallConversionRate: number;
  stages?: FunnelStageMetricDto[];
}

/**
 * Acquisition Traffic Breakdown
 */
export interface AcquisitionMetricsDto {
  source: string;
  medium?: string;
  campaign?: string;
  visits: number;
}

/**
 * Detailed Acquisition Intelligence
 */
export interface AcquisitionIntelligenceDto {
  sources: AcquisitionMetricsDto[];
  topCampaigns: Array<{ campaign: string; source: string; visits: number }>;
  directVisits: number;
  campaignVisits: number;
}

/**
 * Utility Intelligence Record
 */
export interface UtilityIntelligenceDto {
  utilitySlug: string;
  name?: string;
  categorySlug?: string;
  pageViews: number;
  toolStarts: number;
  toolCompletions: number;
  toolErrors: number;
  resultDownloads: number;
  completionRate: number;
  errorRate: number;
  downloadRate: number;
  avgExecutionTimeMs?: number;
}

/**
 * Ad Placement Performance Breakdown
 */
export interface PlacementPerformanceDto {
  placementCode: string;
  name?: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

/**
 * Ad Monetization Intelligence
 */
export interface AdMonetizationIntelligenceDto {
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
  placementPerformance: PlacementPerformanceDto[];
  devicePerformance: Array<{ device: string; impressions: number; clicks: number; ctr: number }>;
  campaignPerformance?: Array<{ campaignId: string; name: string; impressions: number; clicks: number; ctr: number }>;
}

/**
 * Experimentation Contracts
 */
export interface ExperimentVariantDto {
  id: string;
  name: string;
  weight?: number; // Relative weight e.g. 50 (default: equal split)
}

export interface ExperimentDto {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CONCLUDED';
  variants: ExperimentVariantDto[];
  targetUtilitySlugs?: string[];
  targetPlacements?: string[];
  startDate?: string;
  endDate?: string;
}

export interface ExperimentAssignmentDto {
  experimentId: string;
  variantId: string;
  sessionToken: string;
}

export interface ExperimentVariantMetricDto {
  variantId: string;
  name: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
  toolCompletions: number;
  resultDownloads: number;
  adClicks: number;
}

export interface ExperimentResultDto {
  experimentId: string;
  name: string;
  status: string;
  totalExposures: number;
  variants: ExperimentVariantMetricDto[];
  winningVariantId?: string;
}

/**
 * Complete Growth Intelligence Aggregation
 */
export interface GrowthIntelligenceDto {
  periodDays: number;
  funnel: FunnelMetricsDto;
  acquisition: AcquisitionIntelligenceDto;
  utilities: UtilityIntelligenceDto[];
  monetization: AdMonetizationIntelligenceDto;
  experiments: ExperimentResultDto[];
  deviceBreakdown: Array<{ device: string; count: number; percentage: number }>;
}

/**
 * High-level Platform Telemetry Summary
 */
export interface AnalyticsSummaryDto {
  totalEvents: number;
  totalPageViews: number;
  uniqueSessions: number;
  totalToolStarts: number;
  totalToolCompletions: number;
  totalToolErrors: number;
  totalResultDownloads?: number;
  toolCompletionRate: number;
  totalAdImpressions: number;
  totalAdClicks: number;
  adCtr: number;
  totalAiRequests: number;
  funnel?: FunnelMetricsDto;
  acquisition?: AcquisitionMetricsDto[];
  placementPerformance?: PlacementPerformanceDto[];
  breakdownByUtility: AnalyticsUtilityMetric[];
  breakdownByEventType: Record<string, number>;
}

/**
 * Deterministic Hash-Based Experiment Variant Resolver
 * Given an experiment ID and a session token, deterministically maps to a variant.
 */
export function getExperimentVariant(
  experimentId: string,
  sessionToken: string,
  variants: Array<{ id: string; weight?: number }>,
): string {
  if (!variants || variants.length === 0) return 'control';
  if (variants.length === 1) return variants[0].id;

  // Compute 32-bit FNV-1a hash over (experimentId + ':' + sessionToken)
  const key = `${experimentId}:${sessionToken}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positiveHash = (hash >>> 0);

  // Normalize weights
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight && v.weight > 0 ? v.weight : 100), 0);
  const normalizedValue = positiveHash % totalWeight;

  let cumulative = 0;
  for (const v of variants) {
    const weight = v.weight && v.weight > 0 ? v.weight : 100;
    cumulative += weight;
    if (normalizedValue < cumulative) {
      return v.id;
    }
  }

  return variants[0].id;
}

// Backward-compatibility aliases
export type TelemetryEventType =
  | AnalyticsEventType
  | 'page_view'
  | 'tool_start'
  | 'tool_complete'
  | 'tool_error'
  | 'result_download'
  | 'ad_impression'
  | 'ad_click'
  | 'ai_request'
  | 'experiment_exposure';
export type TelemetryEventPayload = AnalyticsEventDto;

// ==========================================
// PHASE 21: JOURNEY & RETENTION CONTRACTS
// ==========================================

export interface JourneyStepDto {
  stepIndex: number;
  eventType: AnalyticsEventType;
  utilitySlug?: string;
  timestamp: string;
}

export interface UserJourneyDto {
  stepCount: number;
  utilitiesEncountered: string[];
  completedTool: boolean;
  downloadedResult: boolean;
  adEngaged: boolean;
}

export interface RetentionCohortDto {
  cohortDate: string; // e.g. "2026-09-01"
  cohortSize: number; // number of unique anonymous session tokens originating on this date
  d1Returning: number;
  d1RetentionRate: number;
  d7Returning: number;
  d7RetentionRate: number;
  d14Returning: number;
  d14RetentionRate: number;
  d30Returning: number;
  d30RetentionRate: number;
  status: 'MATURE' | 'INSUFFICIENT_DATA' | 'PENDING';
}

export interface RetentionMetricsDto {
  totalUniqueTokens: number;
  firstVisitSessions: number;
  returningSessions: number;
  returningVisitorRate: number; // percentage of sessions from returning tokens
  avgSessionsPerToken: number;
  avgUtilitiesPerToken: number;
  overallD1RetentionRate: number;
  overallD7RetentionRate: number;
  overallD30RetentionRate: number;
  retentionMaturityStatus: 'MATURE' | 'INSUFFICIENT_DATA';
}

export interface SessionDepthDto {
  depthCategory: '1 utility' | '2 utilities' | '3 utilities' | '4+ utilities';
  sessionCount: number;
  percentageOfSessions: number;
  toolCompletions: number;
  completionRate: number;
  resultDownloads: number;
  downloadRate: number;
  adImpressions: number;
  adClicks: number;
  adCtr: number;
}

export interface CrossUtilityFlowDto {
  sourceUtilitySlug: string;
  targetUtilitySlug: string;
  sourceUtilityName?: string;
  targetUtilityName?: string;
  transitionCount: number;
  transitionRate: number; // percentage of source sessions that continued to target
  targetCompletionRate: number;
  targetDownloadRate: number;
}

export interface ReturningVisitorMetricsDto {
  firstSessionVolume: number;
  returningSessionVolume: number;
  returnRate: number;
  avgUtilitiesPerSession: number;
  multiUtilityRate: number; // % sessions that used >=2 utilities
}
export type ReturningUserMetricsDto = ReturningVisitorMetricsDto;

export interface AcquisitionRetentionDto {
  source: string;
  visitors: number;
  returningSessions: number;
  returnRate: number;
  d1Rate: number;
  d7Rate: number;
  d30Rate: number;
  journeyQualityScore: number;
}

export interface DeviceRetentionDto {
  device: string;
  sessionCount: number;
  returnRate: number;
  completionRate: number;
  downloadRate: number;
  d1Rate: number;
  d7Rate: number;
}

export interface ExperimentJourneyImpactDto {
  experimentId: string;
  experimentName?: string;
  variantId: string;
  variantName?: string;
  exposures: number;
  returnRate: number;
  completionRate: number;
  multiUtilityRate: number;
  observedImpact: string; // Observational description
  sampleStatus: 'SUFFICIENT' | 'INSUFFICIENT_DATA';
}

export interface JourneyQualityScoreDto {
  score: number; // 0–100 deterministic
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_ATTENTION' | 'INSUFFICIENT_DATA';
  components: {
    completionWeight: number;
    completionScore: number;
    downloadWeight: number;
    downloadScore: number;
    multiUtilityWeight: number;
    multiUtilityScore: number;
    returnWeight: number;
    returnScore: number;
    errorWeight: number;
    errorScore: number;
  };
  explanation: string;
}

export interface RetentionHealthDto {
  score: number; // 0–100 deterministic
  status: 'HEALTHY' | 'MODERATE' | 'NEEDS_ATTENTION' | 'INSUFFICIENT_DATA';
  d1RetentionRate: number;
  d7RetentionRate: number;
  returnVisitorRate: number;
  multiSessionProgressionRate: number;
  explanation: string;
}

export interface JourneyOpportunityDto {
  id: string;
  area: 'ACQUISITION' | 'UTILITY' | 'RETENTION' | 'CROSS_UTILITY' | 'EXPERIMENT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  entity: string;
  reason: string;
  metric: string;
  currentValue: string;
  recommendedAction: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'INSUFFICIENT_DATA';
}

export interface JourneyIntelligenceDto {
  periodDays: number;
  journeyQuality: JourneyQualityScoreDto;
  retentionHealth: RetentionHealthDto;
  returningVisitors: ReturningVisitorMetricsDto;
  retentionSummary: RetentionMetricsDto;
  retentionCohorts: RetentionCohortDto[];
  sessionDepth: SessionDepthDto[];
  crossUtilityFlows: CrossUtilityFlowDto[];
  acquisitionRetention: AcquisitionRetentionDto[];
  deviceRetention: DeviceRetentionDto[];
  experimentImpacts: ExperimentJourneyImpactDto[];
  opportunities: JourneyOpportunityDto[];
}

