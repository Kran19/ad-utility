# External Ad Network Integration & Real Monetization Activation

## 1. Overview & Architecture

Phase 24 introduces external ad network integration as a pluggable, bounded monetization layer beneath the platform's primary internal ad engine.

The platform retains strict first-party orchestration: the internal Ad Engine remains the authoritative layer for targeting, frequency capping, schedule evaluation, and eligibility. External ad networks are never given direct runtime control over rendering or client tracking.

```
                    ┌────────────────────────────────────────┐
                    │       Client / Ad Slot Request         │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │          AdSelectorService             │
                    │  (Evaluates Targeting & Eligibility)   │
                    └───────────────────┬────────────────────┘
                                        │
            ┌───────────────────────────┴───────────────────────────┐
            │                                                       │
            ▼                                                       ▼
 ┌──────────────────────┐                               ┌──────────────────────┐
 │ Tier A: Internal Ad  │ (Active Campaign match)       │ Tier B: External Ad  │ (When eligible & enabled)
 │ (Highest Priority)   │                               │ (Bounded 200ms)      │
 └──────────────────────┘                               └───────────┬──────────┘
                                                                    │
                                                ┌───────────────────┴───────────────────┐
                                                │ Success                               │ Timeout / Error / No Fill
                                                ▼                                       ▼
                                     ┌──────────────────────┐                ┌──────────────────────┐
                                     │ External Creative    │                │ Tier C: House Ad     │
                                     │ Delivered            │                │ (Guaranteed fallback)│
                                     └──────────────────────┘                └───────────┬──────────┘
                                                                                         │ No house ad
                                                                                         ▼
                                                                             ┌──────────────────────┐
                                                                             │ Tier D: Clean No-Ad  │
                                                                             │ (HTTP 200 null)      │
                                                                             └──────────────────────┘
```

---

## 2. Selection Hierarchy & Fallback Rules

Every ad placement request is processed according to a strict 4-tier hierarchy:

1. **Tier A — Internal Ad Campaigns (Highest Priority)**:
   - Evaluated by `AdSelectorService` using targeting rules (category, utility, device, geo, schedule, frequency caps).
   - If an eligible internal campaign creative is found, it is served immediately. External networks are never contacted.

2. **Tier B — External Ad Network (Pluggable Monetization Source)**:
   - Invoked only if:
     - No Tier A internal campaigns are eligible.
     - External ad network is enabled (`AD_NETWORK_ENABLED=true`).
     - The placement is marked `revenueEligible`.
     - The external provider is configured and passes health checks.
   - Enforces a strict 200ms latency budget (`AD_NETWORK_TIMEOUT_MS`).
   - If the network times out or returns an error, the system fails open immediately to Tier C.

3. **Tier C — House Fallback Ad**:
   - Guaranteed platform fallback ad configured as a house campaign (`isHouse: true`).
   - Ensures high fill rate without exposing user to blank spaces when external ads fail or have no fill.

4. **Tier D — Clean No-Ad**:
   - Returns HTTP 200 with `{ ad: null }` and reasons array.
   - Preserves clean layout without broken frames, script errors, or layout shifts.

---

## 3. Privacy, Consent & Telemetry Isolation

### Logical Separation of Telemetry
- **First-Party Telemetry**:
  - `AD_IMPRESSION` and `AD_CLICK` events are logged into the first-party `AnalyticsEvent` table.
  - Zero double-counting: first-party events are signed with HMAC tracking tokens (`TrackingTokenService`).
- **Third-Party Telemetry**:
  - Provider impression beacons (`impressionCallbackUrl`) and click tracking URLs (`clickCallbackUrl`) are fired asynchronously in the background.
  - Provider reporting APIs are queried separately for authoritative monetization figures.
- **Privacy Hardening**:
  - User identifiers, raw IPs, and session cookies are never transmitted to external providers.
  - Only anonymized slot metadata (placement, sanitized dimensions, utility category, coarse device type) is sent in the auction request.

---

## 4. Financial Data Truth Policy & Revenue Synchronization

### Authoritative Financial Ingestion
- Revenue is **never** estimated, projected, or inferred from impressions, clicks, eCPM, or RPM.
- Revenue records are ingested solely through authoritative provider reporting endpoints via `AdRevenueSyncService`.
- Idempotency is strictly enforced by a compound unique constraint: `@@unique([provider, providerReportId])`. Duplicate reports in overlapping sync windows are safely skipped.

### Strict Revenue Availability Statuses
In all admin APIs, Monetization Intelligence, and Business Intelligence payloads:
- `ACTUAL`: Authoritative, verified revenue records exist for the selected period. `actualRevenueTotal` reflects the sum of verified records.
- `ACTUAL_ZERO`: Authoritative provider reporting was received for the period, and confirmed exactly zero revenue ($0.00).
- `UNAVAILABLE`: No external provider reporting has been synced or verified for the period. `actualRevenueTotal` is strictly `null`. Monetary figures are never fabricated.

---

## 5. Admin Control & Operations

### Endpoints
1. `GET /api/v1/admin/ads/provider/health`
   - Returns provider connectivity, configuration state, latency metrics, and recent error counts.
   - Protected by `@RequirePermissions('campaigns:read')`.
2. `POST /api/v1/admin/ads/provider/sync`
   - Triggers on-demand reconciliation of external provider revenue reports for a bounded date range (up to 90 days).
   - Protected by `@RequirePermissions('campaigns:update')`.
3. `GET /api/v1/admin/ads/revenue`
   - Returns paginated verified revenue records with optional date and provider filters.
   - Protected by `@RequirePermissions('campaigns:read')`.

### Operational Runbook: Enabling an External Ad Network
1. Set `AD_NETWORK_ENABLED=true` in environment variables.
2. Configure provider credentials (`AD_NETWORK_PROVIDER`, `AD_NETWORK_API_KEY`, etc.).
3. Verify provider status via `GET /api/v1/admin/ads/provider/health`.
4. Trigger initial historical revenue sync via `POST /api/v1/admin/ads/provider/sync`.
5. Monitor real-time fill rates and revenue breakdown in the Admin Analytics dashboard.
