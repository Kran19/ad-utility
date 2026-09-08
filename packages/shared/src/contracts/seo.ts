/**
 * Phase 10 — SEO Engine & Performance Optimization Contracts
 */

export interface CategoryPublicDto {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  displayOrder: number;
  utilityCount: number;
  utilities: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    implementationMode: string;
    isFeatured: boolean;
    displayOrder: number;
  }>;
}

export interface BreadcrumbItemDto {
  name: string;
  url: string;
  position: number;
}

export interface SitemapEntryDto {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface SiteMetadataDto {
  title: string;
  description: string;
  canonicalUrl: string;
  openGraph?: {
    title: string;
    description: string;
    url: string;
    siteName: string;
    type: string;
    images?: Array<{ url: string; width?: number; height?: number; alt?: string }>;
  };
  twitter?: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
  };
  robots?: {
    index: boolean;
    follow: boolean;
  };
}

// ==========================================
// PHASE 22: SEO & ORGANIC GROWTH CONTRACTS
// ==========================================

export type SeoOpportunityType =
  | 'METADATA_GAP'
  | 'INTERNAL_LINK_GAP'
  | 'HIGH_CONVERSION_DISCOVERY'
  | 'CONTENT_COVERAGE'
  | 'CATEGORY_EXPANSION';

export type SeoPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SeoOpportunityDto {
  id: string;
  utilitySlug?: string;
  categorySlug?: string;
  opportunityType: SeoOpportunityType;
  priority: SeoPriority;
  score: number; // 0–100 deterministic opportunity score
  reason: string;
  recommendedAction: string;
  supportingMetrics: {
    organicPageViews?: number;
    completionRate?: number;
    internalLinksCount?: number;
    healthScore?: number;
  };
}

export interface SeoPageHealthDto {
  slug: string;
  pageType: 'UTILITY' | 'CATEGORY' | 'STATIC';
  name: string;
  hasTitle: boolean;
  hasDescription: boolean;
  hasCanonical: boolean;
  hasOpenGraph: boolean;
  hasTwitterMetadata: boolean;
  hasJsonLd: boolean;
  hasBreadcrumbs: boolean;
  internalLinkCount: number;
  healthScore: number; // 0–100 deterministic
  issues: string[];
}

export interface SeoLandingPageDto {
  slug: string;
  title: string;
  description: string;
  canonicalUrl: string;
  supportedFormats?: string[];
  useCases?: string[];
  howItWorks?: string[];
  relatedUtilities?: Array<{ slug: string; name: string; description: string }>;
  relatedCategory?: { slug: string; name: string };
  faq?: Array<{ question: string; answer: string }>;
  breadcrumbs: BreadcrumbItemDto[];
  hasStructuredData: boolean;
}

export interface SeoInternalLinkOpportunityDto {
  sourceUtilitySlug: string;
  sourceUtilityName: string;
  targetUtilitySlug: string;
  targetUtilityName: string;
  relationshipType: 'RECIPROCAL' | 'SAME_CATEGORY' | 'CROSS_CATEGORY_WORKFLOW';
  reason: string;
  priority: SeoPriority;
}

export interface OrganicAcquisitionDto {
  totalOrganicVisits: number;
  totalOrganicToolStarts: number;
  totalOrganicCompletions: number;
  totalOrganicDownloads: number;
  organicCompletionRate: number;
  organicExportRate: number;
  organicSharePercentage: number;
  topOrganicSources: Array<{ source: string; visits: number; completions: number }>;
}

export interface SeoUtilityPerformanceDto {
  utilitySlug: string;
  name: string;
  categorySlug: string;
  pageViews: number;
  organicPageViews: number;
  toolStarts: number;
  completions: number;
  downloads: number;
  completionRate: number;
  organicConversionRate: number;
  healthScore: number;
  opportunityScore: number;
  internalLinkCount: number;
}

export interface SeoCategoryPerformanceDto {
  categorySlug: string;
  name: string;
  utilityCount: number;
  totalPageViews: number;
  organicPageViews: number;
  completions: number;
  averageHealthScore: number;
  coverageStatus: 'COMPLETE' | 'PARTIAL' | 'NEEDS_REVIEW';
}

export interface SeoContentCoverageDto {
  totalActiveUtilities: number;
  totalCategories: number;
  fullyCoveredPages: number;
  partialPages: number;
  missingPages: number;
  coveragePercentage: number;
  coverageStatus: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'NEEDS_REVIEW';
}

export interface SeoHealthDto {
  overallScore: number; // 0–100 deterministic
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_ATTENTION';
  totalPagesAudited: number;
  averageUtilityHealth: number;
  averageCategoryHealth: number;
  components: {
    metadataCompleteness: number;
    internalLinkCoverage: number;
    structuredDataCoverage: number;
    crawlability: number;
  };
  explanation: string;
}

export interface SeoRecommendationDto {
  id: string;
  category: string;
  utilitySlug?: string;
  priority: SeoPriority;
  score: number;
  reason: string;
  recommendedAction: string;
}

export interface SeoIntelligenceDto {
  periodDays: number;
  health: SeoHealthDto;
  coverage: SeoContentCoverageDto;
  organicAcquisition: OrganicAcquisitionDto;
  utilityPerformance: SeoUtilityPerformanceDto[];
  categoryPerformance: SeoCategoryPerformanceDto[];
  pageHealthList: SeoPageHealthDto[];
  internalLinkOpportunities: SeoInternalLinkOpportunityDto[];
  opportunities: SeoOpportunityDto[];
  sitemapStatus: {
    totalEntries: number;
    activeUtilitiesIncluded: number;
    activeCategoriesIncluded: number;
    status: 'VALID' | 'NEEDS_REVIEW';
  };
}

