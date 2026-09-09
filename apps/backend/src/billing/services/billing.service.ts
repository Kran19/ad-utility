import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from './entitlement.service';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import {
  CreateCheckoutSessionDto,
  CheckoutSessionResponseDto,
  CreatePortalSessionDto,
  PortalSessionResponseDto,
  UserBillingOverviewDto,
  AdminBillingOverviewDto,
  AdminPlanUpdateDto,
  SubscriptionDto,
  PlanDto,
} from '@ad-utility/shared';
import { randomUUID } from 'crypto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    @Inject('PAYMENT_PROVIDER') private readonly provider: PaymentProvider,
  ) {}

  /**
   * List all active public plans
   */
  async getPublicPlans(): Promise<PlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
    return plans.map((p) => this.mapPlan(p));
  }

  /**
   * Create Checkout Session
   */
  async createCheckoutSession(
    userId: string,
    dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan || !plan.active) {
      throw new NotFoundException(`Plan ${dto.planCode} not found or inactive`);
    }

    if (plan.code === 'FREE') {
      throw new BadRequestException('Free plan does not require checkout');
    }

    return await this.provider.createCheckoutSession(dto, user, plan);
  }

  /**
   * Create Customer Portal Session
   */
  async createPortalSession(
    userId: string,
    dto: CreatePortalSessionDto,
  ): Promise<PortalSessionResponseDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const customerId = subscription?.providerCustomerId || `cus_${userId.substring(0, 8)}`;
    return await this.provider.createPortalSession(customerId, dto.returnUrl);
  }

  /**
   * Authoritative Webhook Processor with Signature Verification & Idempotency
   */
  async processWebhook(
    rawPayload: any,
    signature?: string,
  ): Promise<{ success: boolean; eventId: string; status: string; message?: string }> {
    // 1. Verify signature via active payment provider
    const verified = await this.provider.verifyWebhook(rawPayload, signature);
    const { eventId, eventType, data } = verified;

    // 2. Idempotency check: Guard against duplicate event processing
    const existingEvent = await this.prisma.billingEvent.findUnique({
      where: { providerEventId: eventId },
    });
    if (existingEvent) {
      this.logger.warn(`[WEBHOOK IDEMPOTENCY] Duplicate event ${eventId} ignored.`);
      return {
        success: true,
        eventId,
        status: 'DUPLICATE_IGNORED',
        message: 'Event already processed',
      };
    }

    // 3. Sanitize payload: Redact payment credentials/secrets (Recommendation #4)
    const sanitizedPayload = this.sanitizeWebhookPayload(data);

    // 4. Authoritative state machine transitions inside transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        // Record event first
        await tx.billingEvent.create({
          data: {
            provider: this.provider.getProviderType(),
            providerEventId: eventId,
            eventType,
            payload: sanitizedPayload,
            status: 'PROCESSED',
          },
        });

        // Handle specific event types
        if (eventType === 'checkout.session.completed') {
          await this.handleCheckoutSessionCompleted(data, tx);
        } else if (eventType === 'invoice.paid' || eventType === 'subscription.renewed') {
          await this.handleSubscriptionRenewed(data, tx);
        } else if (eventType === 'invoice.payment_failed') {
          await this.handlePaymentFailed(data, tx);
        } else if (
          eventType === 'customer.subscription.deleted' ||
          eventType === 'subscription.canceled'
        ) {
          await this.handleSubscriptionCanceled(data, tx);
        }
      });

      return {
        success: true,
        eventId,
        status: 'PROCESSED',
      };
    } catch (err: any) {
      this.logger.error(`Error processing webhook event ${eventId}:`, err);
      // Record failed event for audit trail
      await this.prisma.billingEvent.upsert({
        where: { providerEventId: eventId },
        update: { status: 'FAILED', errorMessage: err.message },
        create: {
          provider: this.provider.getProviderType(),
          providerEventId: eventId,
          eventType,
          payload: sanitizedPayload,
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      throw err;
    }
  }

  /**
   * User Billing Overview
   */
  async getUserBillingOverview(userId: string): Promise<UserBillingOverviewDto> {
    const plan = await this.entitlementService.getUserPlan(userId);
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const usage = await this.entitlementService.getUserUsageOverview(userId);

    return {
      plan,
      subscription: subscription ? this.mapSubscription(subscription) : null,
      isPremium: plan.code !== 'FREE',
      entitlements: plan.entitlements,
      usage,
      providerMode: this.provider.getProviderType(),
    };
  }

  /**
   * Cancel User Subscription
   */
  async cancelSubscription(
    userId: string,
    atPeriodEnd: boolean = true,
  ): Promise<{ success: boolean; cancelAtPeriodEnd: boolean }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found to cancel');
    }

    // Call provider if subscription ID is present
    if (subscription.providerSubscriptionId) {
      await this.provider.cancelSubscription(
        subscription.providerSubscriptionId,
        atPeriodEnd,
      );
    }

    if (atPeriodEnd) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      });
    } else {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        },
      });
    }

    return { success: true, cancelAtPeriodEnd: atPeriodEnd };
  }

  /**
   * Admin Billing Dashboard Overview (Recommendation #8 & #9)
   */
  async getAdminOverview(): Promise<AdminBillingOverviewDto> {
    const [totalSubscribers, activeCount, canceledCount, pastDueCount, plansCount] =
      await Promise.all([
        this.prisma.subscription.count(),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        this.prisma.subscription.count({ where: { status: 'CANCELED' } }),
        this.prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
        this.prisma.plan.count(),
      ]);

    const providerHealth = this.provider.getHealth();

    return {
      totalSubscribers,
      activeSubscriptions: activeCount,
      canceledSubscriptions: canceledCount,
      pastDueSubscriptions: pastDueCount,
      plansCount,
      providerHealth,
      revenueTruth: {
        actualRevenueTotal: null,
        revenueAvailable: false,
        label: 'MOCK',
        reason: 'Authoritative payment provider financial reports are not configured. Mock transactions are not counted as revenue.',
      },
    };
  }

  /**
   * Admin Subscriptions List
   */
  async getAdminSubscriptions(status?: string, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [total, items] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        include: { plan: true, user: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: items.map((sub) => ({
        ...this.mapSubscription(sub),
        userEmail: sub.user?.email,
      })),
    };
  }

  /**
   * Admin Plans List
   */
  async getAdminPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return plans.map((p) => this.mapPlan(p));
  }

  /**
   * Admin Plan Update
   */
  async updatePlan(id: string, dto: AdminPlanUpdateDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Plan ${id} not found`);
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name ?? plan.name,
        description: dto.description ?? plan.description,
        active: dto.active ?? plan.active,
        displayOrder: dto.displayOrder ?? plan.displayOrder,
        priceCents: dto.priceCents ?? plan.priceCents,
        currency: dto.currency ?? plan.currency,
        entitlements: dto.entitlements
          ? { ...(plan.entitlements as any), ...dto.entitlements }
          : plan.entitlements,
        usageLimits: dto.usageLimits
          ? { ...(plan.usageLimits as any), ...dto.usageLimits }
          : plan.usageLimits,
        metadata: dto.metadata
          ? { ...(plan.metadata as any), ...dto.metadata }
          : plan.metadata,
      },
    });

    return this.mapPlan(updated);
  }

  /**
   * Admin Billing Events Audit Trail
   */
  async getAdminBillingEvents(page: number = 1, pageSize: number = 20) {
    const [total, items] = await Promise.all([
      this.prisma.billingEvent.count(),
      this.prisma.billingEvent.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { processedAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items,
    };
  }

  // --- Private Helpers ---

  private async handleCheckoutSessionCompleted(data: any, tx: any) {
    const customerId = data.customer || data.customerId || `cus_${randomUUID().substring(0, 8)}`;
    const subscriptionId =
      data.subscription || data.subscriptionId || `sub_${randomUUID().substring(0, 8)}`;
    const userEmail = data.customer_email || data.userEmail || data.email;
    const planCode = data.planCode || data.metadata?.planCode || 'PREMIUM';

    let user: any = null;
    if (data.userId) {
      user = await tx.user.findUnique({ where: { id: data.userId } });
    } else if (userEmail) {
      user = await tx.user.findUnique({ where: { email: userEmail } });
    }

    if (!user) {
      this.logger.warn(`Checkout session completed for unknown user: ${userEmail}`);
      return;
    }

    const plan = await tx.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      this.logger.error(`Plan ${planCode} not found for checkout`);
      return;
    }

    const now = new Date();
    const periodEnd = new Date(Date.now() + 30 * 86400000);

    await tx.subscription.upsert({
      where: { providerSubscriptionId: subscriptionId },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        provider: this.provider.getProviderType(),
        providerCustomerId: customerId,
        providerSubscriptionId: subscriptionId,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    this.logger.log(`[SUBSCRIPTION ACTIVE] User ${user.email} activated plan ${plan.code}`);
  }

  private async handleSubscriptionRenewed(data: any, tx: any) {
    const subscriptionId = data.subscription || data.subscriptionId;
    if (!subscriptionId) return;

    const periodEnd = new Date(Date.now() + 30 * 86400000);
    await tx.subscription.updateMany({
      where: { providerSubscriptionId: subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });
  }

  private async handlePaymentFailed(data: any, tx: any) {
    const subscriptionId = data.subscription || data.subscriptionId;
    if (!subscriptionId) return;

    await tx.subscription.updateMany({
      where: { providerSubscriptionId: subscriptionId },
      data: {
        status: 'PAST_DUE',
      },
    });
    this.logger.warn(`[PAYMENT FAILED] Subscription ${subscriptionId} marked PAST_DUE`);
  }

  private async handleSubscriptionCanceled(data: any, tx: any) {
    const subscriptionId = data.subscription || data.subscriptionId || data.id;
    if (!subscriptionId) return;

    await tx.subscription.updateMany({
      where: { providerSubscriptionId: subscriptionId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancelAtPeriodEnd: false,
      },
    });
    this.logger.log(`[SUBSCRIPTION CANCELED] Subscription ${subscriptionId} canceled`);
  }

  private sanitizeWebhookPayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;

    const sanitized = JSON.parse(JSON.stringify(payload));
    const redactKeys = [
      'card',
      'cvv',
      'cvc',
      'number',
      'token',
      'secret',
      'authorization',
      'client_secret',
      'password',
    ];

    const walk = (obj: any) => {
      for (const key of Object.keys(obj)) {
        if (redactKeys.some((k) => key.toLowerCase().includes(k))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          walk(obj[key]);
        }
      }
    };

    walk(sanitized);
    return sanitized;
  }

  private mapPlan(plan: any): PlanDto {
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
      entitlements: plan.entitlements,
      usageLimits: plan.usageLimits,
      metadata: plan.metadata,
      createdAt: plan.createdAt?.toISOString(),
      updatedAt: plan.updatedAt?.toISOString(),
    };
  }

  private mapSubscription(sub: any): SubscriptionDto {
    return {
      id: sub.id,
      userId: sub.userId,
      planId: sub.planId,
      planCode: sub.plan?.code || 'FREE',
      planName: sub.plan?.name || 'Free Plan',
      provider: sub.provider,
      providerCustomerId: sub.providerCustomerId,
      providerSubscriptionId: sub.providerSubscriptionId,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart?.toISOString() || null,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt?.toISOString() || null,
      createdAt: sub.createdAt?.toISOString(),
      updatedAt: sub.updatedAt?.toISOString(),
      userEmail: sub.user?.email,
    };
  }
}
