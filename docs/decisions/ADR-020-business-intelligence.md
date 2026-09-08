# ADR-020: Revenue Attribution, Ad Optimization & Business Intelligence Architecture

## Status
Accepted and Frozen (Phase 20)

## Context
Following the implementation of the Growth Intelligence subsystem (Phase 18) and Monetization Intelligence subsystem (Phase 19), the platform required an executive decision-support and business attribution layer to compose acquisition, conversion funnels, ad yield, and A/B experiments into actionable optimization insights for administrators.

## Decisions

### 1. Composition over Duplication
Rather than rewriting or duplicating underlying SQL queries, `BusinessIntelligenceService` directly consumes and composes `GrowthIntelligenceService` and `MonetizationIntelligenceService`, supplementing them with targeted relational aggregations for UTM acquisition attribution and cross-dimensional yield analysis.

### 2. Zero Fabricated Revenue & Financial Truth Guarantee
In adherence to the platform's strict data truth policy, no fake dollar figures, ROAS, CAC, or financial ROI metrics are generated. When financial billing is absent, `revenueAvailable: false` is explicitly returned, and business value is measured via observed conversion rates, export downloads, ad interactions, and deterministic 0–100 quality scores.

### 3. Non-Causal Language for Observational Signals
Observational correlations between ad exposures and utility completions are labeled using associative terminology ("associated with", "correlated with"), avoiding unsupported causal claims.

### 4. Deterministic Scoring Framework
We introduce three transparent, explainable 0–100 scoring formulas:
- **Acquisition Quality Score (0–100)**: Weights channel completion rate, export rate, and ad engagement.
- **Utility Opportunity Score (0–100)**: Weights traffic volume, completion efficiency, and ad CTR to prioritize tool enhancements.
- **Platform Business Health Score (0–100)**: Composes acquisition quality, funnel conversion, ad efficiency, and system reliability.

### 5. Prioritized Advisory Opportunities
Optimization opportunities are strictly advisory and non-destructive. Each opportunity provides severity, area, entity, metric, reason, recommended action, and confidence level (`HIGH`, `MEDIUM`, `INSUFFICIENT_DATA`).

### 6. Admin API & Redis Caching
Endpoints `GET /api/v1/admin/analytics/business-intelligence` and `GET /api/v1/admin/analytics/business-intelligence/opportunities` are protected by JWT and `@RequirePermissions('analytics:read')`, with 60-second Redis caching and fail-open resilience.

## Consequences
- Single unified executive dashboard for platform administrators.
- Transparent, reproducible business health and quality indicators.
- Safe, non-destructive advisory recommendations.
- Zero risk of revenue misrepresentation.
- Sub-100ms response times for cached business intelligence queries.
