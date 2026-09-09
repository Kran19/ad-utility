import {
  PaymentProviderType,
  PaymentProviderHealthDto,
  CreateCheckoutSessionDto,
  CheckoutSessionResponseDto,
  PortalSessionResponseDto,
} from '@ad-utility/shared';

export interface PaymentProvider {
  getProviderType(): PaymentProviderType;
  isConfigured(): boolean;
  getHealth(): PaymentProviderHealthDto;
  createCheckoutSession(
    dto: CreateCheckoutSessionDto,
    user: { id: string; email: string },
    plan: { id: string; code: string; name: string; priceCents: number; currency: string },
  ): Promise<CheckoutSessionResponseDto>;
  retrieveCheckoutSession(sessionId: string): Promise<any>;
  createPortalSession(
    customerId: string,
    returnUrl?: string,
  ): Promise<PortalSessionResponseDto>;
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<any>;
  verifyWebhook(
    payload: any,
    signature?: string,
  ): Promise<{ eventId: string; eventType: string; data: any }>;
  getSubscription(subscriptionId: string): Promise<any>;
}
