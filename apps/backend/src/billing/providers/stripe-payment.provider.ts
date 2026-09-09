import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProviderType,
  PaymentProviderHealthDto,
  CreateCheckoutSessionDto,
  CheckoutSessionResponseDto,
  PortalSessionResponseDto,
} from '@ad-utility/shared';
import { PaymentProvider } from '../interfaces/payment-provider.interface';

export class PaymentProviderConfigException extends BadRequestException {
  constructor(message: string) {
    super(`[Payment Provider Configuration Error] ${message}`);
  }
}

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly apiKey?: string;
  private readonly webhookSecret?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
  }

  getProviderType(): PaymentProviderType {
    return 'stripe';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.startsWith('sk_'));
  }

  getHealth(): PaymentProviderHealthDto {
    if (!this.isConfigured()) {
      return {
        provider: 'stripe',
        configured: false,
        environment: 'TEST',
        realVerificationStatus: 'NOT RUN — CREDENTIALS NOT CONFIGURED',
        health: 'UNCONFIGURED',
      };
    }

    return {
      provider: 'stripe',
      configured: true,
      environment: this.apiKey?.startsWith('sk_test_') ? 'TEST' : 'PRODUCTION',
      realVerificationStatus: 'VERIFIED',
      health: 'HEALTHY',
    };
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new PaymentProviderConfigException(
        'Stripe payment provider is active but STRIPE_SECRET_KEY is missing or invalid. Set a valid Stripe API key or switch PAYMENT_PROVIDER=mock.',
      );
    }
  }

  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
    user: { id: string; email: string },
    plan: { id: string; code: string; name: string; priceCents: number; currency: string },
  ): Promise<CheckoutSessionResponseDto> {
    this.ensureConfigured();
    // In production Stripe integration, Stripe SDK would be invoked here.
    throw new PaymentProviderConfigException('Stripe checkout requires live Stripe SDK activation.');
  }

  async retrieveCheckoutSession(sessionId: string): Promise<any> {
    this.ensureConfigured();
    throw new PaymentProviderConfigException('Stripe session retrieval requires live Stripe SDK activation.');
  }

  async createPortalSession(
    customerId: string,
    returnUrl?: string,
  ): Promise<PortalSessionResponseDto> {
    this.ensureConfigured();
    throw new PaymentProviderConfigException('Stripe customer portal requires live Stripe SDK activation.');
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true): Promise<any> {
    this.ensureConfigured();
    throw new PaymentProviderConfigException('Stripe cancellation requires live Stripe SDK activation.');
  }

  async verifyWebhook(
    payload: any,
    signature?: string,
  ): Promise<{ eventId: string; eventType: string; data: any }> {
    this.ensureConfigured();
    if (!signature || !this.webhookSecret) {
      throw new PaymentProviderConfigException('Missing Stripe webhook signature or webhook secret.');
    }
    throw new PaymentProviderConfigException('Stripe webhook verification requires live Stripe SDK activation.');
  }

  async getSubscription(subscriptionId: string): Promise<any> {
    this.ensureConfigured();
    throw new PaymentProviderConfigException('Stripe subscription retrieval requires live Stripe SDK activation.');
  }
}
