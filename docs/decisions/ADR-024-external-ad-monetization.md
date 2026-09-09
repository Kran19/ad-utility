# ADR-024: External Ad Network Integration & Real Monetization Activation

## Status
Accepted

## Context
Following the completion and hardening of the core Ad Engine (Phases 5, 11, 19, 20), the platform required activation of real monetization via external ad network providers without compromising first-party delivery guarantees, user privacy, or financial reporting integrity.

Key architectural requirements:
1. Pluggable provider adapter allowing seamless switching between external ad networks (Google AdSense, Ad Manager, Prebid, mock provider).
2. Strict priority preservation: internal campaigns take precedence (Tier A), followed by external network (Tier B), house ads (Tier C), and clean no-ad (Tier D).
3. Low-latency SLA: external ad network requests must timeout within 200ms and fail-open cleanly without disrupting utility execution.
4. Telemetry isolation: first-party impression/click analytics must remain logically separate from third-party provider reporting to prevent double counting.
5. Financial data truth policy: monetary revenue figures must never be guessed, simulated, or derived from CPM/CTR estimates; they must be ingested strictly from authoritative provider reports with deduplication.

## Decisions

1. **Provider Abstraction (`ExternalAdProvider`)**:
   Created `ExternalAdProvider` interface defining standard methods for `fetchAd`, `recordImpressionCallback`, `recordClickCallback`, `syncRevenueReports`, and `healthCheck`.
   Implemented `MockExternalAdProviderService` as the deterministic reference implementation for non-production environments and integration tests.

2. **4-Tier Selection Hierarchy in `AdSelectorService`**:
   - Tier A: Internal direct/sponsored campaigns.
   - Tier B: External ad network (only when enabled and revenue-eligible).
   - Tier C: House/global fallback campaigns.
   - Tier D: Clean no-ad response with HTTP 200.

3. **Strict Bounded Timeout & Fail-Open**:
   Wrapped external network calls in `Promise.race` with a 200ms timeout budget. Any timeout, network exception, or HTTP error logs a warning, decrements provider health, and falls open immediately to Tier C house ads.

4. **Logical Telemetry Separation**:
   First-party telemetry continues to write signed `AD_IMPRESSION` and `AD_CLICK` events to `AnalyticsEvent`.
   Provider beacons are fired asynchronously in the background. Third-party provider metrics and first-party metrics are never mixed or aggregated into a single ambiguous counter.

5. **Financial Truth Policy & Dedicated Revenue Ingestion Model (`AdRevenueRecord`)**:
   Added `AdRevenueRecord` model in Prisma with unique constraint `@@unique([provider, providerReportId])`.
   Monetization Intelligence and Business Intelligence expose `revenueAvailable` (boolean) and `actualRevenueStatus` (`ACTUAL`, `ACTUAL_ZERO`, or `UNAVAILABLE`). If verified reports do not exist, `actualRevenueTotal` is `null` and currency figures are omitted.

6. **Granular RBAC Security**:
   Exposed admin management endpoints under `api/v1/admin/ads/` guarded by permission-based RBAC (`@RequirePermissions('campaigns:read')` and `@RequirePermissions('campaigns:update')`).

## Consequences

### Positive
- Production-grade external monetization capability without vendor lock-in.
- Zero risk of layout freeze or latency spikes due to 200ms fail-open timeout.
- Uncompromising financial accuracy with zero fabricated revenue figures.
- Strict user privacy preserved with anonymized slot auctions.

### Negative / Trade-offs
- Revenue reporting is asynchronous and depends on provider reporting intervals (hourly/daily batch syncs).
- Live real-provider verification requires external account credentials and DNS-verified domains, which are deferred in isolated testing environments.
