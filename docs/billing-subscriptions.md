# Billing, Subscriptions, Payments & Premium Monetization

## 1. Overview & Architecture

Phase 26 introduces an isolated, provider-agnostic billing and entitlement layer into the platform without coupling payment processing to core engines (`UtilityRegistry`, `AdSelectorService`, and `AiGatewayService`).

```
                UTILITYPLATFORM
                      │
       ┌──────────────┴──────────────┐
       │                             │
      FREE                         PREMIUM
       │                             │
   Entitlements                  Entitlements
       │                             │
   Usage Limits                  Higher Limits (20x)
       │                             │
   Advertisements             Configured Ad-Free Policy
       │                             │
       └──────────────┬──────────────┘
                      │ (reads)
              ENTITLEMENT SERVICE
                      │
                BILLING LAYER
                      │
              PAYMENT PROVIDER
          (Mock / Stripe Interface)
                      │
                WEBHOOKS
         (Idempotent & Sanitized)
                      │
                SUBSCRIPTION
                      │
              POSTGRESQL / PRISMA
```

---

## 2. Decoupled Entitlement Architecture

The core engines do not manage payments or check subscriptions directly. Instead, they query the `@Global()` `EntitlementService`:

- **Utility Execution**: Before invoking the execution adapter, `UtilitiesService` queries `EntitlementService.canUseUtility(slug, userId)`. If the utility requires Premium and the user is on the Free tier, a structured `403 Forbidden` response is returned (`code: ENTITLEMENT_REQUIRED`, `upgradeUrl: /pricing`).
- **Atomic Usage Tracking**: Authenticated calls query `EntitlementService.checkAndIncrementUsage(userId, featureKey, count)` in a database transaction. Guest users execute unmetered on an individual account level and remain protected by existing IP rate limiters.
- **Advertising Display**: `AdDeliveryService` queries `EntitlementService.shouldShowAds(userId)`. For ad-free premium subscribers, it returns `{ hasAd: false, reason: 'PREMIUM_AD_FREE' }` without invoking `AdSelectorService` or logging impression telemetry.

---

## 3. Subscription Lifecycle & State Machine

Subscriptions follow an authoritative state machine managed solely by backend-verified webhooks:

```text
FREE (default tier)
  │
  │ checkout initiated
  ▼
CHECKOUT_PENDING
  │
  │ verified webhook processed (checkout.session.completed)
  ▼
ACTIVE (Premium entitlements active)
  │
  ├── renewal webhook (invoice.paid) → ACTIVE
  │
  ├── cancel requested → CANCEL_AT_PERIOD_END (entitlements active until currentPeriodEnd)
  │       │
  │       └── period ends → EXPIRED / FREE
  │
  └── payment failed webhook (invoice.payment_failed)
          ▼
        PAST_DUE
          │
          ├── payment recovered (invoice.paid) → ACTIVE
          └── final failure / grace period expires → EXPIRED / FREE
```

---

## 4. Payment Provider Abstraction & Modes

The platform interacts with payment systems through the `PaymentProvider` interface:

- **Configured Mode**: `PAYMENT_PROVIDER=mock|stripe` (default: `mock`).
- **Mock Provider (`MockPaymentProvider`)**: Deterministic provider for testing and development. Returns simulated checkout and portal sessions, verifies mock webhook signatures, and tags all transactions with `mode: 'MOCK'`.
- **Stripe Provider (`StripePaymentProvider`)**: If `PAYMENT_PROVIDER=stripe` is specified without valid credentials, throws `PaymentProviderConfigException` rather than silently degrading to Mock.
- **Real Provider Acceptance Standard**: In the absence of production payment credentials, the platform reports:
  `REAL PAYMENT PROVIDER VERIFICATION: NOT RUN — CREDENTIALS NOT CONFIGURED`.

---

## 5. Security, Privacy & PCI Scope Zero

1. **Zero Card Ingestion**: Raw card numbers, CVVs, and payment credentials are never accepted, processed, or persisted. Hosted checkout and hosted customer portal sessions are used exclusively.
2. **Webhook Sanitization**: All provider webhook payloads are sanitized before saving to `BillingEvent.payload` to redact cards, CVVs, tokens, and client secrets.
3. **Idempotency**: Webhook deduplication is enforced via a unique database index on `providerEventId`.
4. **Secret Isolation**: Secret keys are restricted to backend environment variables and never exposed to the client or frontend bundles.

---

## 6. Strict Revenue Truth Standard

- **No Fabricated Revenue**: Revenue figures, MRR, ARR, LTV, and profit are never synthesized from mock data or internal estimates.
- **Financial Status Output**: If authoritative provider financial reporting is not active, the system strictly returns:
  - `actualRevenueTotal: null`
  - `revenueAvailable: false`
  - `label: 'MOCK'`
- **Subscriber Counts**: Active subscriber and subscription records are derived authoritatively from database subscriptions and reported distinctly from financial revenue metrics.
