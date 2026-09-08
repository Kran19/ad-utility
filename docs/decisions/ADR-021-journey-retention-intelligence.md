# ADR-021: Advanced Growth, Retention & User Journey Intelligence

## Status
Accepted / Completed & Frozen

## Context
Following the completion of Business Intelligence and Revenue Attribution (Phase 20), the platform required deeper visibility into user discoverability, retention patterns over time, and cross-utility workflows. However, the platform operates under strict privacy guarantees: users are anonymous visitors, no user accounts/CRM/fingerprinting exist, and external analytics systems (Mixpanel, Amplitude, Segment) are strictly avoided.

## Decisions

1. **Anonymous Session Paradigm**:
   - Journey and retention analytics are derived exclusively from first-party telemetry keyed by client-side anonymous session tokens.
   - Raw session tokens are never rendered in dashboard tables, API responses, or system logs.
   - No individual user profiling pages or session inspection features are introduced.

2. **Composition Architecture**:
   - `JourneyIntelligenceService` directly consumes and extends `GrowthIntelligenceService` and `MonetizationIntelligenceService` rather than duplicating SQL extraction or ad yield aggregations.

3. **Deterministic Scoring Models**:
   - Introduced **Journey Quality Score** ($0 - 100$) combining completion ($35\%$), export ($25\%$), multi-tool exploration ($20\%$), return rate ($15\%$), and error-free factor ($5\%$).
   - Introduced **Retention Health Score** ($0 - 100$) combining D1 retention ($35\%$), D7 retention ($30\%$), return visitor rate ($20\%$), and multi-session progression ($15\%$).
   - Scores below sample minimums ($< 5$ units) return `status: 'INSUFFICIENT_DATA'` and score $0$.

4. **Bounded Top-N Cross-Utility Transitions**:
   - Sequential utility transitions are bounded to the top 20 pathways to prevent memory and graph expansion.

5. **Redis Caching & Fail-Open Resilience**:
   - Results are cached in Redis under `admin:journey:summary:${periodDays}` for 60 seconds with fail-open fallback.

6. **Advisory-Only Recommendations**:
   - The Journey Opportunity engine generates actionable suggestions with explicit confidence levels (`HIGH`, `MEDIUM`, `INSUFFICIENT_DATA`) without auto-mutating system configurations.

## Consequences
- Administrators gain executive visibility into platform journey health, retention cohorts (D1, D7, D14, D30), session depth distributions, and cross-tool pathways.
- Zero PII, zero raw session token exposure, zero external AI calls, and zero external analytics dependencies.
- All 297 backend tests across 21 test suites and 16/16 launch smoke tests pass.
