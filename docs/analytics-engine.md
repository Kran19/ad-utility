# First-Party Analytics Engine & Telemetry Architecture

## 1. Executive Summary & Core Guarantees
The First-Party Analytics Engine provides centralized, privacy-preserving, non-blocking telemetry collection across all user interactions on the platform. It tracks page views, utility execution lifecycles (`TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR`), advertising events (`AD_IMPRESSION`, `AD_CLICK`), AI usage, and UTM marketing campaign attribution.

### Architectural Guarantees
1. **Zero Critical Dependency**: Telemetry persistence is strictly non-blocking and asynchronous. If PostgreSQL, Redis, or analytics ingestion experiences latency or downtime, utilities, ads, and AI requests continue executing with 100% availability.
2. **Privacy by Design**: No raw IP addresses, passwords, access tokens, or sensitive user inputs are stored. IPs are transformed into cryptographic one-way SHA-256 hashes (`ipHash`).
3. **Idempotency & Deduplication**: Employs `eventId` caching with a 60-second sliding window to prevent duplicate records from client retries or rapid clicks.
4. **Role-Based Reporting Access**: Public ingestion endpoint (`POST /api/v1/analytics/events`) accepts client telemetry with rate limiting and payload validation, while reporting query endpoints (`GET /api/v1/analytics/summary`) require authenticated `ADMIN` or `SUPER_ADMIN` roles.

---

## 2. Standard Event Taxonomy & Lifecycle
The platform defines 7 canonical, strongly-typed event types:
- `PAGE_VIEW`: Triggered on initial utility page mount.
- `TOOL_START`: Fired when a user initiates a transformation/execution.
- `TOOL_COMPLETE`: Fired only after successful tool processing.
- `TOOL_ERROR`: Fired when execution fails with safe standardized error classification.
- `AD_IMPRESSION`: Ad visibility verified by `IntersectionObserver`.
- `AD_CLICK`: Ad interaction with safe destination resolution.
- `AI_REQUEST`: AI Gateway invocation reference.

---

## 3. Event Contracts & Payload Shapes

```typescript
export type AnalyticsEventType =
  | 'PAGE_VIEW'
  | 'TOOL_START'
  | 'TOOL_COMPLETE'
  | 'TOOL_ERROR'
  | 'AD_IMPRESSION'
  | 'AD_CLICK'
  | 'AI_REQUEST';

export interface AnalyticsEventDto {
  eventId?: string;
  eventType: AnalyticsEventType;
  utilitySlug?: string;
  placementCode?: string;
  creativeId?: string;
  campaignId?: string;
  sessionToken?: string;
  anonymousId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface BatchAnalyticsEventsDto {
  events: AnalyticsEventDto[];
}
```

---

## 4. Session & Attribution Model
- **Session Model**: Anonymous session tokens (`sessionToken`) are generated client-side via cryptographically secure UUIDv4 and stored in `sessionStorage`. They are completely decoupled from user authentication tokens.
- **UTM Attribution**: Implements a **First-Touch Session Attribution Model**. Query parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) are captured on arrival, sanitized against XSS/injection, and persisted with all subsequent session events.

---

## 5. Ingestion, Validation & Async Persistence Pipeline
```
Frontend Client / Browser
      │
      ▼ navigator.sendBeacon / fetch (Non-blocking)
POST /api/v1/analytics/events
      │
      ├─► 1. Rate Limiting (Redis / In-memory sliding window)
      ├─► 2. Payload Validation & Sanitization (UTM length caps, metadata <= 5KB)
      ├─► 3. Deduplication Check (eventId cache with 60s TTL)
      │
      ▼ Asynchronous Persistence (Non-blocking worker / DB write)
PostgreSQL `analytics_events`
```

---

## 6. Failure Isolation & Resilience
- **Database Failure**: If PostgreSQL is unreachable or experiences write timeouts, the error is safely caught and logged. Utility, ad, and AI operations are never interrupted.
- **Redis Failure**: If Redis is offline, rate limiting and deduplication fail open or use local memory fallback so legitimate traffic is not dropped.
- **Client Offline / Network Drop**: Frontend telemetry client uses non-blocking `fetch` with `keepalive: true` or `navigator.sendBeacon` with automatic error swallowing to avoid unhandled browser rejections.

---

## 7. Aggregation & Reporting API
Query service computes platform-level health indicators without table-wide full scans:
- **Tool Completion Rate**: `(TOOL_COMPLETE / TOOL_START) * 100`
- **Error Rate**: `(TOOL_ERROR / TOOL_START) * 100`
- **Ad CTR**: `(AD_CLICK / AD_IMPRESSION) * 100`
- **Unique Sessions**: `COUNT(DISTINCT sessionToken)`

### API Specification
- **`POST /api/v1/analytics/events`** (Public): Ingests single or batched events.
- **`GET /api/v1/analytics/summary`** (Protected): Protected by `JwtAuthGuard` and `RolesGuard` (`ADMIN`, `SUPER_ADMIN`). Returns platform metrics, conversion rates, and tool breakdown.

---

## 8. Frontend Telemetry Client (`lib/analytics.ts`)
- **SSR Safety**: Fully guarded against `window` / `document` access during Next.js server-side rendering.
- **Non-blocking Dispatch**: Buffered fire-and-forget dispatch ensuring 0ms impact on main UI thread.

---

## 9. Subsystem Integrations
- **Utility Engine**: Hooks in `ToolRunner` trigger `TOOL_START`, `TOOL_COMPLETE`, and `TOOL_ERROR` without altering tool logic.
- **Ad Engine**: Canonical ad measurement stays in `ad_impressions` and `ad_clicks`; high-level events inform overall telemetry stream.
- **AI Gateway**: `ai_requests` remains authoritative for model token usage and cost accounting; `AI_REQUEST` records operational telemetry.

---

## 10. Performance & Scaling Considerations
- **Indexes**: Composite B-tree indexes on `(timestamp, utilitySlug)` and `(timestamp, eventType)` ensure sub-5ms range lookups.
- **Data Retention**: 90-day rolling raw data retention with automated daily rollup aggregations.
- **Partitioning Threshold**: Range-based monthly table partitioning on `timestamp` is scheduled when row volume exceeds 10M–50M records.
