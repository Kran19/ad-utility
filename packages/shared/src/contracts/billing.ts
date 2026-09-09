/**
 * Phase 26: Billing, Subscription & Entitlement Contracts
 */

export type PlanTier = 'FREE' | 'PREMIUM' | 'PRO' | 'BUSINESS' | 'TEAM';

export type BillingInterval = 'MONTHLY' | 'YEARLY';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED'
  | 'INCOMPLETE'
  | 'PAUSED';

export type PaymentProviderType = 'mock' | 'stripe';

export interface PlanEntitlements {
  allowedUtilities: string[]; // ["ALL"] or specific slugs
  showAds: boolean;
  features: string[]; // e.g. ["ai-advanced", "unlimited-history", "priority-queue"]
}

export interface PlanUsageLimits {
  dailyAiRequests: number; // e.g. 10 for Free, 200 for Premium
  dailyConversions: number; // e.g. 50 for Free, 1000 for Premium
  maxFileSizeMb?: number;
}

export interface PlanDto {
  id: string;
  code: string; // 'FREE', 'PREMIUM', etc.
  name: string;
  description?: string | null;
  active: boolean;
  displayOrder: number;
  billingInterval?: BillingInterval | null;
  priceCents: number;
  currency: string;
  providerPriceId?: string | null;
  entitlements: PlanEntitlements;
  usageLimits: PlanUsageLimits;
  metadata?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionDto {
  id: string;
  userId: string;
  planId: string;
  planCode: string;
  planName: string;
  provider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  status: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userEmail?: string;
}

export interface CreateCheckoutSessionDto {
  planCode: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponseDto {
  sessionId: string;
  checkoutUrl: string;
  provider: string;
  planCode: string;
  mode: 'MOCK' | 'HOSTED';
  expiresAt?: string;
}

export interface CreatePortalSessionDto {
  returnUrl?: string;
}

export interface PortalSessionResponseDto {
  portalUrl: string;
  provider: string;
  mode: 'MOCK' | 'HOSTED';
}

export interface WebhookEventPayloadDto {
  eventId: string;
  eventType: string;
  provider: string;
  timestamp: string;
  data: Record<string, any>;
  signature?: string;
}

export interface UserUsageRecordDto {
  featureKey: string;
  currentCount: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface UserBillingOverviewDto {
  plan: PlanDto;
  subscription?: SubscriptionDto | null;
  isPremium: boolean;
  entitlements: PlanEntitlements;
  usage: UserUsageRecordDto[];
  providerMode: PaymentProviderType;
}

export interface PaymentProviderHealthDto {
  provider: PaymentProviderType;
  configured: boolean;
  environment: 'TEST' | 'DEVELOPMENT' | 'PRODUCTION';
  realVerificationStatus: 'NOT RUN — CREDENTIALS NOT CONFIGURED' | 'VERIFIED' | 'FAILED';
  health: 'HEALTHY' | 'UNCONFIGURED' | 'ERROR';
}

export interface AdminBillingOverviewDto {
  totalSubscribers: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  plansCount: number;
  providerHealth: PaymentProviderHealthDto;
  revenueTruth: {
    actualRevenueTotal: number | null;
    revenueAvailable: boolean;
    label: 'ACTUAL' | 'ESTIMATED' | 'MOCK';
    reason: string;
  };
}

export interface AdminPlanUpdateDto {
  name?: string;
  description?: string;
  active?: boolean;
  displayOrder?: number;
  priceCents?: number;
  currency?: string;
  entitlements?: Partial<PlanEntitlements>;
  usageLimits?: Partial<PlanUsageLimits>;
  metadata?: Record<string, any>;
}

export interface BillingEventDto {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'PROCESSED' | 'FAILED' | 'IGNORED';
  errorMessage?: string | null;
  processedAt: string;
}
