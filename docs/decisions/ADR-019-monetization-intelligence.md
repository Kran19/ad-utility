# ADR-019: Monetization Intelligence & Revenue Optimization Architecture

## Status
Accepted and Frozen (Phase 19)

## Context
Following the implementation of the Ad Engine (Phase 5), First-Party Analytics (Phase 6), Growth Intelligence, and Experimentation (Phase 18), the platform required an analytical intelligence layer to monitor ad yield, evaluate placement and creative effectiveness, detect device performance disparities, and advise admins on optimization opportunities without modifying the core 12-step deterministic ad selection engine.

## Decisions

### 1. Zero Fabricated Revenue Guarantee
Because the platform does not currently charge credit cards or connect to external SSP/DSP networks, no fictitious revenue amounts or monetary estimations are manufactured. All reporting explicitly separates observed physical interactions (impressions, clicks, CTR) from proxy metrics (optimization score, engagement index).

### 2. Deterministic Optimization Scoring
We implement a transparent, explainable 0–100 optimization scoring algorithm for both placements and creatives based on normalized CTR against platform benchmarks (2.0% target CTR), traffic volume health, and underperformance penalties.

### 3. Advisory-Only Recommendations Engine
The recommendation engine analyzes metrics across placements, creatives, formats, devices, and utilities. All generated recommendations are strictly advisory and non-destructive. No automated mutations to campaigns, priorities, or schedules are performed.

### 4. Admin API & RBAC
Two dedicated admin endpoints are introduced:
- `GET /api/v1/admin/analytics/monetization`
- `GET /api/v1/admin/analytics/monetization/recommendations`
Both endpoints require JWT authentication and the `analytics:read` permission.

### 5. Redis Caching with Fail-Open Resilience
Monetization intelligence summaries are cached in Redis with a 60-second TTL (`admin:monetization:intel:${periodDays}`). If Redis is unavailable or encounters connection timeouts, queries execute directly against PostgreSQL without failing.

### 6. Privacy & PII Protection
In accordance with ADR-011 and ADR-018, all monetization queries use hashed identifiers or aggregated summaries. No raw IP addresses, user emails, or tokens are exposed in API payloads.

## Consequences
- Full visibility into ad inventory performance, format yields, and device disparities.
- Zero risk of revenue misrepresentation.
- Clean separation between ad delivery execution and monetization analytics.
- Sub-100ms response times for cached analytics queries.
