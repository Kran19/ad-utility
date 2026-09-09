# ADR-026: Decoupled Billing, Subscriptions, Payments & Premium Monetization

## Status
Accepted

## Context
Phase 26 requires the introduction of a monetization layer supporting Free and Premium users, subscriptions, payments, entitlements, and daily usage limits. Critical requirements dictate that payments must NOT become tightly coupled to utility execution, `AdSelectorService`, or `AiGatewayService`. Furthermore, strict revenue truth must be maintained: no fabricated revenue or financial metrics may be displayed, and mock provider transactions must never masquerade as production revenue.

## Decision
1. **Dedicated Entitlement Layer**:
   Create a centralized `EntitlementService` that resolves a user's plan and entitlements (`canUseUtility`, `shouldShowAds`, `checkAndIncrementUsage`). Core services query `EntitlementService` rather than implementing billing logic.
2. **Provider Abstraction**:
   Implement a `PaymentProvider` interface with a deterministic `MockPaymentProvider` (default) and `StripePaymentProvider`. Explicit provider selection via `PAYMENT_PROVIDER=mock|stripe`. If Stripe is selected without credentials, raise `PaymentProviderConfigException` instead of silently falling back.
3. **Webhook Authoritative State & Idempotency**:
   Entitlements are only granted upon receipt of valid provider webhooks. Deduplication is enforced via `BillingEvent.providerEventId` unique constraint. All webhook payloads are sanitized before saving to database.
4. **Zero Cardholder Data Scope**:
   Use provider-hosted checkout and customer portal sessions. Never handle or store raw card numbers, CVVs, or payment tokens.
5. **Separation of Revenue Truth from Subscription Accounting**:
   Active subscriber counts are reported directly from PostgreSQL subscription records. Financial revenue figures report `actualRevenueTotal = null` and `revenueAvailable = false` unless authoritative provider financial statements are configured.
6. **Frozen AdSelectorService**:
   `AdDeliveryService` performs entitlement checks before calling `AdSelectorService`. Ad-free premium users receive `{ hasAd: false, reason: 'PREMIUM_AD_FREE' }` without altering the core ad selection scoring algorithm.

## Consequences
- **Positive**:
  - Utility and Ad engines remain completely decoupled from billing mechanisms.
  - Development and automated testing can run deterministically without live Stripe credentials.
  - Zero risk of PCI-DSS compliance scope creep.
  - Race-condition safe atomic usage limit accounting.
- **Negative / Trade-offs**:
  - Offline entitlement checks rely on cached plan definitions in the database.
  - Live Stripe testing requires configuring real sandbox credentials.
