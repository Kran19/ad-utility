/**
 * Canonical Analytics Event Types
 */
export type AnalyticsEventType =
  | 'PAGE_VIEW'
  | 'TOOL_START'
  | 'TOOL_COMPLETE'
  | 'TOOL_ERROR'
  | 'AD_IMPRESSION'
  | 'AD_CLICK'
  | 'AI_REQUEST';

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
  completionRate: number;
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
  toolCompletionRate: number;
  totalAdImpressions: number;
  totalAdClicks: number;
  adCtr: number;
  totalAiRequests: number;
  breakdownByUtility: AnalyticsUtilityMetric[];
  breakdownByEventType: Record<string, number>;
}

// Backward-compatibility aliases
export type TelemetryEventType = AnalyticsEventType | 'page_view' | 'tool_start' | 'tool_complete' | 'tool_error' | 'ad_impression' | 'ad_click' | 'ai_request';
export type TelemetryEventPayload = AnalyticsEventDto;
