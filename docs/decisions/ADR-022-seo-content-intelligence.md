# ADR-022: SEO Content Intelligence, Programmatic Landing Pages & Organic Growth Engine

## Status
Accepted and Frozen (Phase 22)

## Context
The platform requires an organic acquisition and SEO intelligence layer to monitor indexation health, audit metadata completeness, discover programmatic internal linking pathways, and prioritize high-conversion utilities for organic discovery. This must be achieved entirely through first-party telemetry and deterministic algorithms without depending on paid third-party SEO APIs (e.g. Ahrefs, SEMrush, Moz) or fabricating artificial search rankings.

## Decision
1. **Shared SEO Contracts**: Extended `@ad-utility/shared` (`packages/shared/src/contracts/seo.ts`) with typed contracts for SEO opportunities, technical page health, internal link recommendations, content coverage, organic acquisition, and overall SEO health indicators.
2. **First-Party Organic Classification**: Classify incoming traffic as organic using UTM medium (`organic`, `search`), UTM source (`google`, `bing`, `duckduckgo`, etc.), or first-party event metadata, avoiding third-party tracker scripts.
3. **Deterministic 0–100 Opportunity Scoring**: Score utility growth opportunities using observable signals: Task Completion Strength (35%), Demand Signal (25%), On-Page Health Gap (20%), and Internal Link Gap (20%).
4. **Reciprocal & Workflow Internal Linking**: Implement deterministic reciprocal link pairings and category sibling cross-linking to enhance crawler discoverability and user session depth.
5. **Admin Analytics Integration**: Provide protected REST endpoints under `/api/v1/admin/analytics/seo` guarded by `@RequirePermissions('analytics:read')` and cached in Redis with a 60-second TTL fail-open policy.
6. **Frontend Experience**: Add a dedicated **SEO & Organic Growth** view to the Admin Analytics control panel displaying technical health gauges, organic KPIs, opportunity queues, utility performance tables, category coverage matrices, and sitemap discoverability checks.
7. **Zero Fabrication & AI Mock Safety**: Do not fabricate keyword volumes or search engine rankings. Keep all AI utilities in mock mode (`AI_PROVIDER=mock`) with zero external OpenAI dependencies.

## Consequences
- **Positive**:
  - Full transparency into platform organic acquisition and technical SEO health.
  - Actionable, explainable recommendations for improving on-page content and internal links.
  - Zero external recurring API costs for search engine data.
  - Enhanced crawlability and discoverability across all active utilities and category landing pages.
- **Negative / Trade-offs**:
  - Keyword rankings outside first-party referrers are not tracked directly without Google Search Console integration.
