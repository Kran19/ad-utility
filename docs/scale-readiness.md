# Scale Readiness, Caching & Performance Engineering Guide

## 1. Executive Summary

Phase 17 hardens the **Utility + Ad Platform** for scale readiness, fast response latencies, and high-throughput execution without introducing unnecessary operational dependencies (such as Kubernetes, Kafka, or PgBouncer).

---

## 2. Performance Baseline & Post-Optimization Measurements

| Endpoint | Method | Baseline Avg / P50 / P95 | Post-Optimization Avg / P50 / P95 | Target Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/health` | GET | 15.5ms / 5ms / 210ms | **8.4ms / 5ms / 74ms** | PASS (<100ms) |
| `/api/v1/health/liveness` | GET | 4.4ms / 3ms / 23ms | **3.4ms / 3ms / 15ms** | PASS (<50ms) |
| `/api/v1/health/readiness` | GET | 13.5ms / 5ms / 154ms | **4.7ms / 4ms / 10ms** | PASS (<100ms) |
| `/api/v1/utilities` | GET | 31.1ms / 8ms / 173ms | **6.6ms / 6ms / 16ms** | PASS (<100ms) |
| `/api/v1/utilities/categories` | GET | 6.1ms / 4ms / 27ms | **7.8ms / 5ms / 34ms** | PASS (<100ms) |
| `/api/v1/utilities/:slug` | GET | 4.9ms / 4ms / 12ms | **5.6ms / 6ms / 8ms** | PASS (<100ms) |
| `/utilities/case-converter/execute` | POST | 50.4ms / 50ms / 64ms | **49.2ms / 48ms / 88ms** | PASS (<500ms) |
| `/utilities/text-cleaner/execute` | POST | 48.4ms / 48ms / 55ms | **48.8ms / 48ms / 66ms** | PASS (<500ms) |
| `/ads/slot` (Delivery) | POST | 50.5ms / 51ms / 97ms | **54.1ms / 52ms / 76ms** | PASS (<100ms) |
| `/analytics/events` (Ingestion) | POST | 44.9ms / 44ms / 49ms | **46.2ms / 47ms / 51ms** | PASS (<100ms) |

---

## 3. Redis Cache Policy Matrix

| Cache Key Pattern | TTL (Seconds) | Component Owner | Invalidation Trigger | Failure Mode |
| :--- | :--- | :--- | :--- | :--- |
| `utility_cache:detail:<slug>` | 300 (5 min) | `UtilitiesCacheService` | Admin utility update / publish | **Fail-Open** (Queries PostgreSQL directly) |
| `utility_cache:list:<category>` | 300 (5 min) | `UtilitiesCacheService` | Admin utility or category update | **Fail-Open** (Queries PostgreSQL directly) |
| `utility_cache:categories:list` | 300 (5 min) | `UtilitiesCacheService` | Admin category creation / update | **Fail-Open** (Queries PostgreSQL directly) |
| `cache:adslot:<placement>:<cat>`| 60 (1 min) | `RedisAdCacheService` | Admin campaign/creative/targeting mutation | **Fail-Open** (Runs 12-step SQL selection) |
| `freq:camp:<id>:sess:<sess>:day`| 172,800 (48h) | `RedisAdCacheService` | Automatic rolling TTL expiration | **Fail-Open** (Allows ad delivery) |
| `analytics:dedupe:<eventId>` | 86,400 (24h) | `AnalyticsDeduplicationService` | Automatic rolling TTL expiration | **Fail-Open** (Ingests event) |

---

## 4. Public API HTTP Caching Headers

Public read endpoints serve edge-cacheable and browser-cacheable HTTP headers:
- `GET /api/v1/utilities`: `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`
- `GET /api/v1/utilities/categories`: `Cache-Control: public, max-age=120, s-maxage=600, stale-while-revalidate=1200`
- `GET /api/v1/utilities/:slug`: `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`
- `GET /api/v1/utilities/categories/:categorySlug`: `Cache-Control: public, max-age=120, s-maxage=600, stale-while-revalidate=1200`

---

## 5. Database Query Efficiency & N+1 Prevention

- **Single Relational Queries**: `listPublicCategories` and `listPublicUtilities` execute single joined/included queries with indexed `displayOrder` and `status` filters, preventing N+1 loop queries.
- **Bounded Pagination**: Administrative lists (`listCampaigns`, `listCreatives`, `listUtilities`, `listUsers`, `listAuditLogs`) enforce max page sizes (`take: Math.min(pageSize, 100)`).
- **Asynchronous Non-Blocking Persistence**: Ad impressions, clicks, analytics events, and AI telemetry persist asynchronously without blocking HTTP response lifecycles.

---

## 6. Resource Bounds & Concurrency Controls

- **Express JSON Body Size**: 70MB limit allows large base64 file payloads to reach adapter-level guards.
- **Per-Adapter File Bounds**: 15MB images, 20MB PDFs, max 20 pages rasterization for `pdf-to-jpg`.
- **Execution Timers**: Bounded execution (10s–25s) with clean `clearTimeout` in `finally` blocks.
- **Mock AI Rate Limiting**: 15 req/min per identifier with budget ceiling guard.
