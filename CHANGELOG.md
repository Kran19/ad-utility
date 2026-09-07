# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Completed Phase 7 (First-Party Analytics Engine & Telemetry Collection).
- Shared contracts in `@ad-utility/shared`: `AnalyticsEventType`, `AnalyticsEventDto`, `AnalyticsBatchIngestionDto`, `AnalyticsQueryDto`, `AnalyticsUtilityMetric`, `AnalyticsSummaryDto`.
- Backend `AnalyticsModule` (`apps/backend/src/analytics/`):
  - `AnalyticsValidationService`: Validates event types (`PAGE_VIEW`, `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR`, `AD_IMPRESSION`, `AD_CLICK`, `AI_REQUEST`), sanitizes UTM campaign attribution parameters, and caps metadata payloads (5KB max).
  - `AnalyticsDeduplicationService`: Implements sliding 60-second window `eventId` deduplication preventing duplicate browser submissions.
  - `AnalyticsService`: Non-blocking asynchronous event ingestion in PostgreSQL `analytics_events` and aggregated reporting summaries (`totalPageViews`, `uniqueSessions`, `toolCompletionRate`, `adCtr`, `breakdownByUtility`).
  - `AnalyticsController`: Exposing public `POST /api/v1/analytics/events` and RBAC-protected `GET /api/v1/analytics/summary`.
- Frontend Telemetry Integration:
  - `apps/frontend/src/lib/analytics.ts`: SSR-safe client telemetry library with UTM parameter capture from URL and `sendBeacon` / `fetch` non-blocking dispatch.
  - `apps/frontend/src/components/utility/tool-runner.tsx`: Emits `TOOL_START`, `TOOL_COMPLETE`, and `TOOL_ERROR` telemetry events during tool execution.
- Automated Phase 7 test suite in [`apps/backend/test/analytics.spec.ts`](file:///c:/Users/Admin/Desktop/projects/ad-utility/apps/backend/test/analytics.spec.ts) (76/76 total backend tests passing across database, auth, utility engine, ad engine, AI gateway, and analytics).
- Documentation in [`docs/analytics-engine.md`](file:///c:/Users/Admin/Desktop/projects/ad-utility/docs/analytics-engine.md) and [`docs/decisions/ADR-007-first-party-analytics-architecture.md`](file:///c:/Users/Admin/Desktop/projects/ad-utility/docs/decisions/ADR-007-first-party-analytics-architecture.md).
