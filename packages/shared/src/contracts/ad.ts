export type AdPlacement =
  | 'HEADER_BANNER'
  | 'TOP_CONTENT'
  | 'AFTER_TOOL'
  | 'MID_CONTENT'
  | 'BOTTOM_CONTENT'
  | 'SIDEBAR'
  | 'MOBILE_STICKY'
  | 'DESKTOP_STICKY';

export type DeviceType = 'MOBILE' | 'TABLET' | 'DESKTOP';

export type CreativeType = 'IMAGE' | 'VIDEO' | 'HTML' | 'IFRAME';

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';

/**
 * Ad Slot Request Payload sent by frontend or client
 */
export interface AdSlotRequestDto {
  placement: AdPlacement;
  utilitySlug?: string;
  categorySlug?: string;
  device?: DeviceType;
  country?: string;
  sessionId?: string;
  userId?: string;
}

export type MonetizationSource = 'INTERNAL' | 'EXTERNAL_NETWORK' | 'HOUSE_FALLBACK';

/**
 * Public Creative Payload returned in Ad Slot response
 */
export interface AdCreativePayload {
  creativeId: string;
  campaignId: string;
  type: CreativeType;
  mediaUrl?: string;
  targetUrl?: string;
  width?: number;
  height?: number;
  altText?: string;
  customHtml?: string;
  trackingToken: string;
  provider?: string;
  providerAdId?: string;
  monetizationSource?: MonetizationSource;
  revenueEligible?: boolean;
  externalMetadata?: Record<string, any>;
}

/**
 * Ad Slot Response Payload
 */
export interface AdSlotResponseDto {
  hasAd: boolean;
  placement: AdPlacement;
  creative?: AdCreativePayload;
  fallbackTier?: string;
  sessionId?: string;
  provider?: string;
  providerRequestId?: string;
  monetizationSource?: MonetizationSource;
  reason?: string;
}

/**
 * Request payload to record an ad impression
 */
export interface AdImpressionRequestDto {
  trackingToken: string;
  placement: AdPlacement;
  utilitySlug?: string;
  device?: DeviceType;
  country?: string;
  sessionId?: string;
}

/**
 * Request payload to record an ad click
 */
export interface AdClickRequestDto {
  trackingToken: string;
  placement: AdPlacement;
  utilitySlug?: string;
  device?: DeviceType;
  country?: string;
  sessionId?: string;
}

/**
 * Response payload for click tracking (authoritative destination URL)
 */
export interface AdClickResponseDto {
  destinationUrl: string;
}

// Backward-compatible aliases
export type AdSlotRequest = AdSlotRequestDto;
export type AdSlotResponse = AdSlotResponseDto;

/**
 * ==========================================
 * PHASE 19: REVENUE & MONETIZATION INTELLIGENCE
 * ==========================================
 */

export interface AdYieldSummaryDto {
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
  fillRateAvailable: boolean;
  fillRateProxy?: number;
  activeCampaignsCount: number;
  activeCreativesCount: number;
  activePlacementsCount: number;
  topPlacementByCtr?: { placementCode: string; ctr: number };
  topCreativeByCtr?: { creativeId: string; name: string; ctr: number };
  topUtilityByEngagement?: { utilitySlug: string; name: string; adEngagementRate: number };
}

export interface PlacementYieldDto {
  placementCode: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  optimizationScore: number;
  status: 'HIGH_PERFORMING' | 'AVERAGE' | 'UNDERPERFORMING' | 'INSUFFICIENT_DATA';
  completionCorrelationRate?: number;
}

export interface CreativePerformanceDto {
  creativeId: string;
  name: string;
  type: CreativeType;
  impressions: number;
  clicks: number;
  ctr: number;
  optimizationScore: number;
  status: 'HIGH_PERFORMING' | 'AVERAGE' | 'UNDERPERFORMING' | 'INSUFFICIENT_DATA';
}

export interface DeviceYieldDto {
  device: DeviceType;
  impressions: number;
  clicks: number;
  ctr: number;
  engagementIndex: number;
}

export interface UtilityMonetizationDto {
  utilitySlug: string;
  name: string;
  categorySlug: string;
  impressions: number;
  clicks: number;
  ctr: number;
  toolStarts: number;
  toolCompletions: number;
  completionRate: number;
  adEngagementRate: number;
}

export type RecommendationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type RecommendationCategory = 'PLACEMENT' | 'CREATIVE' | 'CAMPAIGN' | 'DEVICE' | 'UTILITY' | 'EXPERIMENT';

export interface MonetizationRecommendationDto {
  id: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  entity: string;
  metric: string;
  reason: string;
  recommendedAction: string;
  impactEstimate?: string;
}

export interface ExperimentMonetizationDto {
  experimentId: string;
  name: string;
  variants: Array<{
    variantId: string;
    name: string;
    impressions: number;
    clicks: number;
    ctr: number;
    toolCompletions: number;
    completionRate: number;
    sampleSizeSufficient: boolean;
  }>;
}

export interface ToolCreativePerformanceDto {
  utilitySlug: string;
  utilityName: string;
  categorySlug: string;
  creativeId: string;
  creativeName: string;
  creativeType: CreativeType;
  mediaUrl: string | null;
  targetUrl: string | null;
  altText: string | null;
  placementCode: string;
  placementName: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface MonetizationIntelligenceDto {
  periodDays: number;
  summary: AdYieldSummaryDto;
  placementYield: PlacementYieldDto[];
  creativePerformance: CreativePerformanceDto[];
  toolCreativePerformance?: ToolCreativePerformanceDto[];
  devicePerformance: DeviceYieldDto[];
  utilityMonetization: UtilityMonetizationDto[];
  recommendations: MonetizationRecommendationDto[];
  experimentMonetization: ExperimentMonetizationDto[];
  formatBreakdown: Array<{ type: CreativeType; impressions: number; clicks: number; ctr: number }>;
  actualRevenueTotal?: number | null;
  actualRevenueStatus?: 'ACTUAL' | 'UNAVAILABLE';
  actualRevenueCurrency?: string;
  revenueByPlacement?: Record<string, number>;
  revenueByUtility?: Record<string, number>;
  revenueByDevice?: Record<string, number>;
  revenueByProvider?: Record<string, number>;
  providerHealth?: ProviderHealthDto;
}

/**
 * ==========================================
 * PHASE 20: REVENUE ATTRIBUTION & BUSINESS INTELLIGENCE
 * ==========================================
 */

export interface BusinessKpisDto {
  totalPageViews: number;
  totalToolStarts: number;
  totalToolCompletions: number;
  totalResultDownloads: number;
  totalAdImpressions: number;
  totalAdClicks: number;
  overallCtr: number;
  funnelCompletionRate: number;
  downloadRate: number;
  activeUtilitiesCount: number;
  activeCampaignsCount: number;
  activeExperimentsCount: number;
  revenueAvailable: boolean;
  actualRevenueTotal?: number | null;
  actualRevenueCurrency?: string;
  businessValueProxy: number;
}

export interface AcquisitionAttributionDto {
  source: string;
  medium?: string;
  campaign?: string;
  visits: number;
  toolStarts: number;
  toolCompletions: number;
  resultDownloads: number;
  adImpressions: number;
  adClicks: number;
  ctr: number;
  completionRate: number;
  downloadRate: number;
  acquisitionQualityScore: number;
  status: 'HIGH_QUALITY' | 'AVERAGE' | 'LOW_QUALITY' | 'INSUFFICIENT_DATA';
}

export interface UtilityBusinessValueDto {
  utilitySlug: string;
  name: string;
  categorySlug: string;
  trafficVolume: number;
  completionRate: number;
  downloadRate: number;
  adCtr: number;
  adEngagementRate: number;
  opportunityScore: number;
  priorityRank: number;
}

export interface AdBusinessValueDto {
  placementCode: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  completionAssociationRate: number;
  optimizationScore: number;
  yieldTier: 'PREMIUM' | 'STANDARD' | 'LOW_PERFORMING';
}

export interface CrossDimensionalYieldDto {
  dimension: 'CHANNEL_PLACEMENT' | 'DEVICE_PLACEMENT' | 'UTILITY_PLACEMENT';
  segmentA: string;
  segmentB: string;
  impressions: number;
  clicks: number;
  ctr: number;
  completionRate: number;
}

export interface BusinessHealthDto {
  overallScore: number;
  status: 'EXCELLENT' | 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';
  components: {
    acquisitionQuality: number;
    funnelHealth: number;
    monetizationEfficiency: number;
    reliabilityHealth: number;
  };
}

export interface OptimizationOpportunityDto {
  id: string;
  area: 'ACQUISITION' | 'UTILITY' | 'AD' | 'EXPERIMENT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entity: string;
  reason: string;
  metric: string;
  currentValue: string;
  recommendedAction: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'INSUFFICIENT_DATA';
}

export interface BusinessIntelligenceDto {
  periodDays: number;
  kpis: BusinessKpisDto;
  health: BusinessHealthDto;
  acquisitionAttribution: AcquisitionAttributionDto[];
  utilityBusinessValues: UtilityBusinessValueDto[];
  adBusinessValues: AdBusinessValueDto[];
  crossDimensionalYields: CrossDimensionalYieldDto[];
  opportunities: OptimizationOpportunityDto[];
}

/**
 * ==========================================
 * PHASE 24: EXTERNAL AD NETWORK & REAL MONETIZATION
 * ==========================================
 */

export interface ProviderHealthDto {
  status: 'CONFIGURED' | 'NOT_CONFIGURED';
  health: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  provider: string;
  lastSuccessfulRequest: string | null;
  lastSuccessfulSync: string | null;
  lastErrorTimestamp: string | null;
  lastErrorMessage: string | null;
  errorCount: number;
  totalRequests: number;
  fallbackRate: number;
}

export interface AdRevenueRecordDto {
  id: string;
  provider: string;
  providerReportId?: string | null;
  date: string;
  placement?: string | null;
  utilitySlug?: string | null;
  categorySlug?: string | null;
  deviceType?: DeviceType | null;
  impressions: number;
  clicks: number;
  revenue: number;
  currency: string;
  source: string;
  status: 'ACTUAL' | 'ACTUAL_ZERO' | 'UNAVAILABLE';
  importedAt: string;
}

export interface MonetizationSyncRequestDto {
  startDate?: string;
  endDate?: string;
}

export interface MonetizationSyncResponseDto {
  startDate: string;
  endDate: string;
  recordsIngested: number;
  duplicatesSkipped: number;
  totalRevenue: number;
  currency: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  importedAt: string;
}



