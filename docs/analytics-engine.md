# First-Party Analytics Engine & Telemetry Architecture

## 1. Executive Summary
The First-Party Analytics Engine provides centralized, privacy-preserving, non-blocking telemetry collection across all user interactions on the platform.
It tracks page views, utility execution lifecycles (`TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR`), advertising events (`AD_IMPRESSION`, `AD_CLICK`), AI usage, and UTM marketing campaign attribution.

---

## 2. Core Architectural Guarantees
1. **Zero Critical Dependency**: Telemetry persistence is strictly non-blocking and asynchronous. If PostgreSQL, Redis, or analytics ingestion experiences latency or downtime, utilities, ads, and AI requests continue executing with 100% availability.
2. **Privacy by Design**: No raw IP addresses, passwords, access tokens, or sensitive user inputs are stored. IPs are transformed into cryptographic one-way hashes (`ipHash`).
3. **Canonical Event Taxonomy**: Strongly-typed events:
   - `PAGE_VIEW`: Triggered on initial utility page mount.
   - `TOOL_START`: Fired when a user initiates a transformation/execution.
   - `TOOL_COMPLETE`: Fired only after successful tool processing.
   - `TOOL_ERROR`: Fired when execution fails with safe standardized error classification.
   - `AD_IMPRESSION`: Ad visibility verified by `IntersectionObserver`.
   - `AD_CLICK`: Ad interaction with safe destination resolution.
   - `AI_REQUEST`: AI Gateway invocation reference.
4. **Idempotency & Deduplication**: Employs `eventId` caching with a 60-second sliding window to prevent duplicate records from client retries or rapid clicks.
5. **Role-Based Reporting Access**: Public ingestion endpoint (`POST /api/v1/analytics/events`) accepts client telemetry with rate limiting and payload validation, while reporting query endpoints (`GET /api/v1/analytics/summary`) require authenticated `ADMIN` or `SUPER_ADMIN` roles.

---

## 3. Ingestion & Storage Architecture
```
Frontend Client / Browser
      │
      ▼ navigator.sendBeacon / fetch (Non-blocking)
POST /api/v1/analytics/events
      │
      ├─► 1. Rate Limiting (Redis / Memory)
      ├─► 2. Payload Validation & Sanitization (UTM, metadata size caps)
      ├─► 3. Deduplication Check (eventId cache)
      │
      ▼ Asynchronous Persistence (Non-blocking)
PostgreSQL `analytics_events`
```

---

## 4. Aggregation & Metrics Calculation
The query service computes platform-level health indicators without table-wide full scans:
- **Tool Completion Rate**: `(TOOL_COMPLETE / TOOL_START) * 100`
- **Error Rate**: `(TOOL_ERROR / TOOL_START) * 100`
- **Ad CTR**: `(AD_CLICK / AD_IMPRESSION) * 100`
- **Unique Sessions**: `COUNT(DISTINCT sessionToken)`
