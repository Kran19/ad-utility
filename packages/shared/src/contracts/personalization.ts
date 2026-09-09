/**
 * Privacy-Safe Personalization & Conversion Optimization Contracts
 * Phase 23 — Utility + Ad Platform
 *
 * All contracts operate strictly on ephemeral, anonymous contextual signals.
 * ZERO individual user profiling, ZERO cross-session history persistence,
 * ZERO raw session token or IP address exposure.
 */

export type DeviceClass = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export type AcquisitionChannel =
  | 'organic'
  | 'paid'
  | 'social'
  | 'referral'
  | 'direct'
  | 'unknown';

export type PersonalizationSurface =
  | 'HERO_CTA'
  | 'TOOL_START_CTA'
  | 'POST_COMPLETION_CTA'
  | 'DOWNLOAD_CTA'
  | 'RELATED_UTILITIES'
  | 'CATEGORY_NAVIGATION';

export type ExperienceType =
  | 'CTA'
  | 'RELATED_UTILITIES'
  | 'COMPLETION_RECOMMENDATION'
  | 'POST_DOWNLOAD';

export type ConversionOpportunityType =
  | 'CTA_OPTIMIZATION'
  | 'WORKSPACE_FRICTION'
  | 'DOWNLOAD_FRICTION'
  | 'RELATED_UTILITY_DISCOVERY'
  | 'MOBILE_OPTIMIZATION';

export type PersonalizationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Ephemeral Request Context
 * Completely stateless and unpersisted.
 */
export interface PersonalizationContextDto {
  utilitySlug?: string;
  categorySlug?: string;
  deviceType: DeviceClass;
  acquisitionChannel: AcquisitionChannel;
  sessionDepth: number;
  currentStep?: 'LANDING' | 'TOOL_START' | 'TOOL_COMPLETE' | 'RESULT_DOWNLOAD';
  experimentAssignments?: Record<string, string>;
  currentStepCompleted?: boolean;
}

/**
 * Personalization Variant Definition
 */
export interface PersonalizationVariantDto {
  variantId: string;
  name: string;
  headline?: string;
  ctaText?: string;
  description?: string;
  recommendedSlugs?: string[];
}

/**
 * Personalization Decision Output
 */
export interface PersonalizationDecisionDto {
  surface: PersonalizationSurface;
  experienceType: ExperienceType;
  variantId: string;
  reason: string;
  confidence: number;
  ruleId?: string;
  experimentId?: string;
  payload: {
    ctaText?: string;
    headline?: string;
    recommendedSlugs?: string[];
    [key: string]: any;
  };
}

/**
 * Deterministic Personalization Rule
 */
export interface PersonalizationRuleDto {
  id: string;
  name: string;
  surface: PersonalizationSurface;
  priority: number;
  isActive: boolean;
  description: string;
  conditions: {
    utilitySlug?: string;
    categorySlug?: string;
    minSessionDepth?: number;
    deviceType?: DeviceClass;
    acquisitionChannel?: AcquisitionChannel;
    currentStepCompleted?: boolean;
  };
  targetVariantId: string;
  payload: {
    ctaText?: string;
    headline?: string;
    recommendedSlugs?: string[];
  };
}

/**
 * Surface-level Recommendation
 */
export interface PersonalizationRecommendationDto {
  surface: PersonalizationSurface;
  currentVariant: string;
  recommendedVariant: string;
  reason: string;
  priority: PersonalizationPriority;
  score: number;
}

/**
 * Conversion Opportunity Diagnostic
 */
export interface ConversionOpportunityDto {
  id: string;
  title: string;
  type: ConversionOpportunityType;
  utilitySlug?: string;
  categorySlug?: string;
  score: number; // 0-100 deterministic prioritization index
  priority: PersonalizationPriority;
  what: string;
  why: string;
  action: string;
  supportingMetrics: {
    views: number;
    starts: number;
    completions: number;
    downloads: number;
    startRate: number;
    completionRate: number;
    downloadRate: number;
  };
}

/**
 * CTA Surface Performance
 */
export interface CtaSurfacePerformanceDto {
  surface: PersonalizationSurface;
  variantId: string;
  impressions: number;
  conversions: number;
  ctr: number;
}

/**
 * Related Utility Performance
 */
export interface RelatedUtilityPerformanceDto {
  sourceSlug: string;
  targetSlug: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
}

/**
 * Device-level Conversion Breakdown
 */
export interface DeviceConversionBreakdownDto {
  deviceType: DeviceClass;
  views: number;
  starts: number;
  completions: number;
  downloads: number;
  startRate: number;
  completionRate: number;
  downloadRate: number;
}

/**
 * Channel-level Conversion Breakdown
 */
export interface ChannelConversionBreakdownDto {
  channel: AcquisitionChannel;
  views: number;
  starts: number;
  completions: number;
  downloads: number;
  startRate: number;
  completionRate: number;
  downloadRate: number;
}

/**
 * Consolidated Personalization & Conversion Intelligence DTO
 */
export interface PersonalizationIntelligenceDto {
  periodDays: number;
  readinessScore: number; // 0-100 deterministic readiness index
  conversionOverview: {
    totalViews: number;
    totalStarts: number;
    totalCompletions: number;
    totalDownloads: number;
    overallStartRate: number;
    overallCompletionRate: number;
    overallDownloadRate: number;
  };
  opportunities: ConversionOpportunityDto[];
  ctaPerformance: CtaSurfacePerformanceDto[];
  relatedUtilityPerformance: RelatedUtilityPerformanceDto[];
  devicePerformance: DeviceConversionBreakdownDto[];
  acquisitionPerformance: ChannelConversionBreakdownDto[];
  activeRules: PersonalizationRuleDto[];
  experimentPrecedenceCount: number;
  recommendations: PersonalizationRecommendationDto[];
}
