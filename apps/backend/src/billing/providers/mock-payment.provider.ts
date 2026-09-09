import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProviderType,
  PaymentProviderHealthDto,
  CreateCheckoutSessionDto,
  CheckoutSessionResponseDto,
  PortalSessionResponseDto,
} from '@ad-utility/shared';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  getProviderType(): PaymentProviderType {
    return 'mock';
  }

  isConfigured(): boolean {
    return false; // Real credentials are intentionally not configured
  }

  getHealth(): PaymentProviderHealthDto {
    return {
      provider: 'mock',
      configured: false,
      environment: 'DEVELOPMENT',
      realVerificationStatus: 'NOT RUN — CREDENTIALS NOT CONFIGURED',
      health: 'HEALTHY',
    };
  }

  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
    user: { id: string; email: string },
    plan: { id: string; code: string; name: string; priceCents: number; currency: string },
  ): Promise<CheckoutSessionResponseDto> {
    const sessionId = `mock_cs_${randomUUID().substring(0, 12)}`;
    this.logger.log(`[MOCK BILLING] Created checkout session ${sessionId} for user ${user.email}, plan ${plan.code}`);

    const baseReturnUrl = dto.successUrl || 'http://localhost:3000/account/billing';
    const checkoutUrl = `${baseReturnUrl}?session_id=${sessionId}&status=success&mock=true`;

    return {
      sessionId,
      checkoutUrl,
      provider: 'mock',
      planCode: plan.code,
      mode: 'MOCK',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  async retrieveCheckoutSession(sessionId: string): Promise<any> {
    return {
      id: sessionId,
      provider: 'mock',
      status: 'complete',
      payment_status: 'paid',
      customer: `mock_cus_${randomUUID().substring(0, 8)}`,
      subscription: `mock_sub_${randomUUID().substring(0, 8)}`,
    };
  }

  async createPortalSession(
    customerId: string,
    returnUrl?: string,
  ): Promise<PortalSessionResponseDto> {
    const portalUrl = returnUrl || 'http://localhost:3000/account/billing';
    return {
      portalUrl: `${portalUrl}?portal_session=mock&customer_id=${customerId}`,
      provider: 'mock',
      mode: 'MOCK',
    };
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true): Promise<any> {
    this.logger.log(`[MOCK BILLING] Subscription ${subscriptionId} marked for cancellation (atPeriodEnd=${atPeriodEnd})`);
    return {
      id: subscriptionId,
      status: atPeriodEnd ? 'active' : 'canceled',
      cancel_at_period_end: atPeriodEnd,
      canceled_at: new Date().toISOString(),
    };
  }

  async verifyWebhook(
    payload: any,
    signature?: string,
  ): Promise<{ eventId: string; eventType: string; data: any }> {
    // In mock provider, if signature is "invalid_signature", reject it deterministically
    if (signature === 'invalid_signature') {
      throw new Error('Invalid mock webhook signature');
    }

    const eventId = payload.eventId || payload.id || `mock_evt_${randomUUID().substring(0, 10)}`;
    const eventType = payload.eventType || payload.type || 'checkout.session.completed';
    const data = payload.data || payload;

    return {
      eventId,
      eventType,
      data,
    };
  }

  async getSubscription(subscriptionId: string): Promise<any> {
    return {
      id: subscriptionId,
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor((Date.now() + 30 * 86400000) / 1000),
      cancel_at_period_end: false,
    };
  }
}
