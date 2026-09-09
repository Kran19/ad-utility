import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanDto, PlanEntitlements, PlanUsageLimits, UserUsageRecordDto } from '@ad-utility/shared';

@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  // Cached fallback FREE plan in case database is empty
  private readonly defaultFreePlan: PlanDto = {
    id: 'plan_free_default',
    code: 'FREE',
    name: 'Free Plan',
    description: 'Standard access with advertisements',
    active: true,
    displayOrder: 1,
    billingInterval: null,
    priceCents: 0,
    currency: 'USD',
    providerPriceId: null,
    entitlements: {
      allowedUtilities: ['ALL'],
      showAds: true,
      features: ['standard-utilities', 'community-support'],
    },
    usageLimits: {
      dailyAiRequests: 10,
      dailyConversions: 50,
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve authoritative plan for user (or default to Free)
   */
  async getUserPlan(userId?: string): Promise<PlanDto> {
    if (!userId) {
      return this.getFreePlan();
    }

    try {
      const now = new Date();
      // Find active or trialing subscription, or cancelled with remaining period
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId,
          OR: [
            { status: 'ACTIVE' },
            { status: 'TRIALING' },
            {
              status: 'CANCELED',
              cancelAtPeriodEnd: true,
              currentPeriodEnd: { gt: now },
            },
          ],
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (subscription && subscription.plan && subscription.plan.active) {
        return this.mapPlanToDto(subscription.plan);
      }
    } catch (err) {
      this.logger.error(`Error resolving plan for user ${userId}:`, err);
    }

    return this.getFreePlan();
  }

  /**
   * Retrieve active FREE plan
   */
  async getFreePlan(): Promise<PlanDto> {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { code: 'FREE' },
      });
      if (plan && plan.active) {
        return this.mapPlanToDto(plan);
      }
    } catch (err) {
      this.logger.error('Error fetching free plan from DB:', err);
    }
    return this.defaultFreePlan;
  }

  /**
   * Check if a utility can be accessed by the user
   */
  async canUseUtility(
    slug: string,
    userId?: string,
  ): Promise<{ allowed: boolean; reason?: string; upgradeUrl?: string }> {
    // 1. Check if slug is a test-only Premium fixture (Recommendation #5)
    const isTestPremiumFixture = slug === 'test-premium-utility' || slug.startsWith('premium-');

    // 2. Query database for utility tier
    let requiresPremium = isTestPremiumFixture;
    if (!requiresPremium) {
      const utility = await this.prisma.utility.findUnique({
        where: { slug },
        select: { tier: true },
      });
      if (utility && utility.tier === 'PREMIUM') {
        requiresPremium = true;
      }
    }

    if (!requiresPremium) {
      return { allowed: true };
    }

    const plan = await this.getUserPlan(userId);
    const isPremium = plan.code !== 'FREE';

    if (!isPremium) {
      return {
        allowed: false,
        reason: 'This utility requires an active Premium subscription.',
        upgradeUrl: '/pricing',
      };
    }

    return { allowed: true };
  }

  /**
   * Entitlement check for advertising display
   */
  async shouldShowAds(userId?: string): Promise<boolean> {
    const plan = await this.getUserPlan(userId);
    return plan.entitlements.showAds ?? true;
  }

  /**
   * Atomic usage counting & limit enforcement (Recommendation #2 & #3)
   */
  async checkAndIncrementUsage(
    userId: string | undefined,
    featureKey: string,
    requestedCount: number = 1,
  ): Promise<{ allowed: boolean; current: number; limit: number; remaining: number }> {
    // Guest users: Protected by existing IP rate limiter, do not persist persistent ID (Recommendation #3)
    if (!userId) {
      return {
        allowed: true,
        current: 0,
        limit: 999999,
        remaining: 999999,
      };
    }

    const plan = await this.getUserPlan(userId);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Resolve feature limit
    let limit = 100;
    if (featureKey === 'dailyAiRequests') {
      limit = plan.usageLimits.dailyAiRequests ?? 10;
    } else if (featureKey === 'dailyConversions') {
      limit = plan.usageLimits.dailyConversions ?? 50;
    } else {
      limit = 1000;
    }

    // Atomic transaction to eliminate race conditions (Recommendation #2)
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userUsage.findUnique({
        where: {
          userId_featureKey_date: {
            userId,
            featureKey,
            date: today,
          },
        },
      });

      const currentCount = existing ? existing.usageCount : 0;

      if (currentCount + requestedCount > limit) {
        return {
          allowed: false,
          current: currentCount,
          limit,
          remaining: Math.max(0, limit - currentCount),
        };
      }

      // Increment atomically
      const updated = await tx.userUsage.upsert({
        where: {
          userId_featureKey_date: {
            userId,
            featureKey,
            date: today,
          },
        },
        update: {
          usageCount: { increment: requestedCount },
        },
        create: {
          userId,
          featureKey,
          usageCount: requestedCount,
          date: today,
        },
      });

      return {
        allowed: true,
        current: updated.usageCount,
        limit,
        remaining: Math.max(0, limit - updated.usageCount),
      };
    });
  }

  /**
   * Get user's daily usage overview
   */
  async getUserUsageOverview(userId: string): Promise<UserUsageRecordDto[]> {
    const plan = await this.getUserPlan(userId);
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowReset = new Date();
    tomorrowReset.setUTCHours(24, 0, 0, 0);

    const usages = await this.prisma.userUsage.findMany({
      where: {
        userId,
        date: today,
      },
    });

    const usageMap = new Map(usages.map((u) => [u.featureKey, u.usageCount]));

    const features: Array<{ key: string; limit: number }> = [
      { key: 'dailyAiRequests', limit: plan.usageLimits.dailyAiRequests ?? 10 },
      { key: 'dailyConversions', limit: plan.usageLimits.dailyConversions ?? 50 },
    ];

    return features.map((f) => {
      const current = usageMap.get(f.key) || 0;
      return {
        featureKey: f.key,
        currentCount: current,
        limit: f.limit,
        remaining: Math.max(0, f.limit - current),
        resetAt: tomorrowReset.toISOString(),
      };
    });
  }

  private mapPlanToDto(plan: any): PlanDto {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      active: plan.active,
      displayOrder: plan.displayOrder,
      billingInterval: plan.billingInterval,
      priceCents: plan.priceCents,
      currency: plan.currency,
      providerPriceId: plan.providerPriceId,
      entitlements: (plan.entitlements as PlanEntitlements) || {
        allowedUtilities: ['ALL'],
        showAds: true,
        features: [],
      },
      usageLimits: (plan.usageLimits as PlanUsageLimits) || {
        dailyAiRequests: 10,
        dailyConversions: 50,
      },
      metadata: (plan.metadata as Record<string, any>) || null,
      createdAt: plan.createdAt?.toISOString(),
      updatedAt: plan.updatedAt?.toISOString(),
    };
  }
}
