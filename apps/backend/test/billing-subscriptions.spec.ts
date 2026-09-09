import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingService } from '../src/billing/services/billing.service';
import { EntitlementService } from '../src/billing/services/entitlement.service';
import { StripePaymentProvider, PaymentProviderConfigException } from '../src/billing/providers/stripe-payment.provider';
import { AdDeliveryService } from '../src/ads/services/ad-delivery.service';
import { randomUUID } from 'crypto';

jest.setTimeout(35000);

describe('Phase 26: Billing, Subscriptions, Payments & Premium Monetization', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;
  let billingService: BillingService;
  let entitlementService: EntitlementService;
  let adDeliveryService: AdDeliveryService;

  let superAdminToken: string;
  let testUserToken: string;
  let testUserId: string;
  let testUserEmail: string;
  let testSubId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    billingService = moduleFixture.get<BillingService>(BillingService);
    entitlementService = moduleFixture.get<EntitlementService>(EntitlementService);
    adDeliveryService = moduleFixture.get<AdDeliveryService>(AdDeliveryService);

    // Login SuperAdmin
    const adminLogin = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    superAdminToken = adminLogin.accessToken;

    // Create a dedicated test user for subscription tests
    testUserEmail = `billing_test_${randomUUID().substring(0, 8)}@example.com`;
    const createdUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        passwordHash: '$2a$10$FakeHashForTestingOnly1234567890123456789012',
        firstName: 'Test',
        lastName: 'BillingUser',
      },
    });
    testUserId = createdUser.id;

    // Generate token for test user
    const tokenResult = (authService as any).jwtService.sign({
      sub: testUserId,
      email: testUserEmail,
      roles: [],
      permissions: [],
    });
    testUserToken = tokenResult;
  });

  afterAll(async () => {
    // Clean up test subscriptions, usage, and user
    if (testUserId) {
      await prisma.userUsage.deleteMany({ where: { userId: testUserId } });
      await prisma.subscription.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await prisma.billingEvent.deleteMany({
      where: { providerEventId: { startsWith: 'test_evt_' } },
    });
    await app.close();
  });

  describe('1. Plan Models & Public Gating', () => {
    it('should list active public plans via GET /api/v1/billing/plans', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/billing/plans')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const codes = res.body.data.map((p: any) => p.code);
      expect(codes).toContain('FREE');
      expect(codes).toContain('PREMIUM');
    });

    it('should resolve default FREE plan for unauthenticated or new users', async () => {
      const freePlan = await entitlementService.getUserPlan(undefined);
      expect(freePlan.code).toBe('FREE');
      expect(freePlan.entitlements.showAds).toBe(true);
      expect(freePlan.usageLimits.dailyAiRequests).toBe(10);
      expect(freePlan.usageLimits.dailyConversions).toBe(50);
    });

    it('should resolve default FREE plan for an authenticated user with no active subscription', async () => {
      const plan = await entitlementService.getUserPlan(testUserId);
      expect(plan.code).toBe('FREE');
      expect(plan.entitlements.showAds).toBe(true);
    });
  });

  describe('2. Entitlements & Utility Access Gating', () => {
    it('should allow free utility access for free users', async () => {
      const access = await entitlementService.canUseUtility('json-formatter', testUserId);
      expect(access.allowed).toBe(true);
    });

    it('should reject access to Premium-only utility fixtures for free users with ENTITLEMENT_REQUIRED', async () => {
      // Recommendation #5: Controlled test fixture check
      const access = await entitlementService.canUseUtility('test-premium-utility', testUserId);
      expect(access.allowed).toBe(false);
      expect(access.upgradeUrl).toBe('/pricing');
      expect(access.reason).toContain('Premium subscription');
    });

    it('should reject public utility execution if utility requires Premium (HTTP 403)', async () => {
      // Execute with test-premium-utility slug
      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/test-premium-utility/execute')
        .send({ input: 'test data' })
        .expect(403);

      expect(res.body.code).toBe('ENTITLEMENT_REQUIRED');
      expect(res.body.upgradeUrl).toBe('/pricing');
    });
  });

  describe('3. Atomic Usage Limits & Accounting', () => {
    it('should atomically allow and increment usage within plan limits', async () => {
      const result1 = await entitlementService.checkAndIncrementUsage(
        testUserId,
        'dailyAiRequests',
        2,
      );
      expect(result1.allowed).toBe(true);
      expect(result1.current).toBe(2);
      expect(result1.limit).toBe(10);
      expect(result1.remaining).toBe(8);

      const result2 = await entitlementService.checkAndIncrementUsage(
        testUserId,
        'dailyAiRequests',
        3,
      );
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(5);
      expect(result2.remaining).toBe(5);
    });

    it('should reject usage increments exceeding the daily limit without advancing the counter', async () => {
      // Requesting 6 more when current is 5 and limit is 10 (5 + 6 = 11 > 10)
      const resultExceeded = await entitlementService.checkAndIncrementUsage(
        testUserId,
        'dailyAiRequests',
        6,
      );
      expect(resultExceeded.allowed).toBe(false);
      expect(resultExceeded.current).toBe(5); // Counter remained at 5
      expect(resultExceeded.remaining).toBe(5);
    });

    it('should return safe unmetered status for guest users without persisting identity (Recommendation #3)', async () => {
      const guestUsage = await entitlementService.checkAndIncrementUsage(
        undefined,
        'dailyAiRequests',
        1,
      );
      expect(guestUsage.allowed).toBe(true);

      // Verify no guest record was created in database
      const guestRecords = await prisma.userUsage.findMany({
        where: { userId: '' },
      });
      expect(guestRecords.length).toBe(0);
    });
  });

  describe('4. Checkout Flow & Mock Payment Provider', () => {
    it('should reject checkout creation for Free plan', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ planCode: 'FREE' })
        .expect(400);

      expect(res.body.message).toContain('Free plan does not require checkout');
    });

    it('should create a checkout session for Premium plan using Mock provider', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          planCode: 'PREMIUM',
          successUrl: 'http://localhost:3000/pricing?status=success',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.mode).toBe('MOCK');
      expect(res.body.data.provider).toBe('mock');
      expect(res.body.data.checkoutUrl).toContain('mock_cs_');
      expect(res.body.data.checkoutUrl).toContain('mock=true');
    });

    it('should create customer portal session for user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/portal')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ returnUrl: 'http://localhost:3000/account/billing' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.mode).toBe('MOCK');
      expect(res.body.data.portalUrl).toContain('portal_session=mock');
    });
  });

  describe('5. Webhook Processing, Idempotency & Sanitization', () => {
    const testEventId = `test_evt_${randomUUID().substring(0, 10)}`;

    beforeAll(() => {
      testSubId = `mock_sub_${randomUUID().substring(0, 8)}`;
    });

    it('should reject invalid webhook signatures', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/billing/webhook')
        .set('x-mock-signature', 'invalid_signature')
        .send({
          eventId: 'evt_invalid_sig',
          eventType: 'checkout.session.completed',
        })
        .expect(500); // Provider signature validation exception
    });

    it('should process valid checkout.session.completed webhook and activate subscription', async () => {
      const payload = {
        eventId: testEventId,
        eventType: 'checkout.session.completed',
        data: {
          userId: testUserId,
          planCode: 'PREMIUM',
          subscription: testSubId,
          customer: `cus_${randomUUID().substring(0, 8)}`,
          // Sensitive data to test sanitization (Recommendation #4)
          card: { number: '4242424242424242', cvv: '123' },
          client_secret: 'secret_live_sensitive_data',
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/webhook')
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PROCESSED');

      // Verify subscription is ACTIVE in DB
      const sub = await prisma.subscription.findUnique({
        where: { providerSubscriptionId: testSubId },
      });
      expect(sub).toBeDefined();
      expect(sub?.status).toBe('ACTIVE');
      expect(sub?.userId).toBe(testUserId);
    });

    it('should enforce idempotency on duplicate webhook events without duplicate effects', async () => {
      const duplicatePayload = {
        eventId: testEventId, // Same event ID
        eventType: 'checkout.session.completed',
        data: {
          userId: testUserId,
          planCode: 'PREMIUM',
          subscription: testSubId,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/webhook')
        .send(duplicatePayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DUPLICATE_IGNORED');
    });

    it('should verify that sensitive card & secret fields were sanitized in BillingEvent log', async () => {
      const eventLog = await prisma.billingEvent.findUnique({
        where: { providerEventId: testEventId },
      });
      expect(eventLog).toBeDefined();
      const storedPayload = eventLog?.payload as any;
      expect(storedPayload.card).toBe('[REDACTED]');
      expect(storedPayload.client_secret).toBe('[REDACTED]');
      expect(JSON.stringify(storedPayload)).not.toContain('4242424242424242');
    });

    it('should reflect active Premium entitlements now that subscription is active', async () => {
      const plan = await entitlementService.getUserPlan(testUserId);
      expect(plan.code).toBe('PREMIUM');
      expect(plan.entitlements.showAds).toBe(false);
      expect(plan.usageLimits.dailyAiRequests).toBe(200);

      // Utility check should now be allowed
      const access = await entitlementService.canUseUtility('test-premium-utility', testUserId);
      expect(access.allowed).toBe(true);
    });
  });

  describe('6. Ad Experience by Plan & Frozen AdSelectorService', () => {
    it('should deliver ads for free users', async () => {
      const result = await adDeliveryService.getAdForSlot(
        {
          placement: 'TOP_CONTENT' as any,
          utilitySlug: 'json-formatter',
          categorySlug: 'developer',
          device: 'MOBILE' as any,
          userId: 'unsubscribed_free_user',
        },
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        '127.0.0.1',
      );

      expect(result.hasAd).toBe(true);
      expect(result.creative).toBeDefined();
    });

    it('should return ad-free response for Premium users without recording impressions (Recommendation #6)', async () => {
      const result = await adDeliveryService.getAdForSlot(
        {
          placement: 'HEADER_BANNER' as any,
          userId: testUserId, // Active Premium subscriber
        },
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        '127.0.0.1',
      );

      expect(result.hasAd).toBe(false);
      expect(result.reason).toBe('PREMIUM_AD_FREE');
      expect(result.creative).toBeUndefined();
    });
  });

  describe('7. Subscription Lifecycle (Renewal, Payment Failure, Cancellation, Expiration)', () => {
    const lifecycleSubId = `mock_lifecycle_${randomUUID().substring(0, 8)}`;

    it('should handle invoice.payment_failed and transition subscription to PAST_DUE', async () => {
      // Activate subscription first
      await billingService.processWebhook({
        eventId: `test_evt_life_1_${randomUUID().substring(0, 6)}`,
        eventType: 'checkout.session.completed',
        data: {
          userId: testUserId,
          planCode: 'PREMIUM',
          subscription: lifecycleSubId,
        },
      });

      // Send failure webhook
      await billingService.processWebhook({
        eventId: `test_evt_fail_${randomUUID().substring(0, 6)}`,
        eventType: 'invoice.payment_failed',
        data: {
          subscription: lifecycleSubId,
        },
      });

      const sub = await prisma.subscription.findUnique({
        where: { providerSubscriptionId: lifecycleSubId },
      });
      expect(sub?.status).toBe('PAST_DUE');
    });

    it('should handle invoice.paid recovery and restore status to ACTIVE', async () => {
      await billingService.processWebhook({
        eventId: `test_evt_renew_${randomUUID().substring(0, 6)}`,
        eventType: 'invoice.paid',
        data: {
          subscription: lifecycleSubId,
        },
      });

      const sub = await prisma.subscription.findUnique({
        where: { providerSubscriptionId: lifecycleSubId },
      });
      expect(sub?.status).toBe('ACTIVE');
    });

    it('should schedule cancellation at period end when requested by user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/cancel')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ atPeriodEnd: true })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.cancelAtPeriodEnd).toBe(true);

      // Entitlements should still remain active until period ends
      const plan = await entitlementService.getUserPlan(testUserId);
      expect(plan.code).toBe('PREMIUM');
    });

    it('should handle customer.subscription.deleted and revoke Premium access', async () => {
      await billingService.processWebhook({
        eventId: `test_evt_del_1_${randomUUID().substring(0, 6)}`,
        eventType: 'customer.subscription.deleted',
        data: {
          subscription: lifecycleSubId,
        },
      });
      await billingService.processWebhook({
        eventId: `test_evt_del_2_${randomUUID().substring(0, 6)}`,
        eventType: 'customer.subscription.deleted',
        data: {
          subscription: testSubId,
        },
      });

      const sub = await prisma.subscription.findUnique({
        where: { providerSubscriptionId: lifecycleSubId },
      });
      expect(sub?.status).toBe('CANCELED');

      // User plan falls back to FREE
      const plan = await entitlementService.getUserPlan(testUserId);
      expect(plan.code).toBe('FREE');
    });
  });

  describe('8. Admin Billing & Revenue Truth & Provider Health', () => {
    it('should enforce RBAC on Admin Billing endpoints', async () => {
      // Anonymous request
      await request(app.getHttpServer())
        .get('/api/v1/admin/billing/overview')
        .expect(401);

      // Regular non-admin user request
      await request(app.getHttpServer())
        .get('/api/v1/admin/billing/overview')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);
    });

    it('should provide authoritative subscriber counts while keeping Revenue Truth separated (Recommendation #8)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/billing/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // Subscriber counts are authoritative numbers
      expect(typeof data.totalSubscribers).toBe('number');
      expect(typeof data.activeSubscriptions).toBe('number');

      // Strict Revenue Truth verification
      expect(data.revenueTruth.actualRevenueTotal).toBeNull();
      expect(data.revenueTruth.revenueAvailable).toBe(false);
      expect(data.revenueTruth.label).toBe('MOCK');
    });

    it('should display Payment Provider Health with real verification status (Recommendation #9)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/billing/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const health = res.body.data.providerHealth;
      expect(health.provider).toBe('mock');
      expect(health.configured).toBe(false);
      expect(health.environment).toBe('DEVELOPMENT');
      expect(health.realVerificationStatus).toBe('NOT RUN — CREDENTIALS NOT CONFIGURED');
      expect(health.health).toBe('HEALTHY');
    });

    it('should safely reject unconfigured Stripe provider with PaymentProviderConfigException (Recommendation #1)', () => {
      const mockConfig: any = {
        get: (key: string) => (key === 'STRIPE_SECRET_KEY' ? undefined : null),
      };
      const unconfiguredStripe = new StripePaymentProvider(mockConfig);
      expect(unconfiguredStripe.isConfigured()).toBe(false);

      expect(() => {
        (unconfiguredStripe as any).ensureConfigured();
      }).toThrow(PaymentProviderConfigException);
    });
  });
});
