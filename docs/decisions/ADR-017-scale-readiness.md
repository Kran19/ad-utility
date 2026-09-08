# ADR-017: Scale Readiness, Caching Strategy & Performance Engineering Architecture

## Status
ACCEPTED / FROZEN

## Date
2026-09-08

## Context
As traffic scales across the unified ad+utility platform, public catalog browsing, ad delivery evaluation, analytics ingestion, and server utility execution must remain sub-100ms for lightweight APIs and bounded under concurrency.

## Decisions

### 1. Multi-Tiered Targeted Caching
- **Redis Utility Catalog Cache**: Public utilities and categories cached with 5-minute TTL (`UtilitiesCacheService`).
- **Redis Ad Slot Cache**: Evaluated ad slot responses cached for 60 seconds with targeted invalidation on campaign/creative/targeting mutation (`RedisAdCacheService`).
- **HTTP Edge & Browser Caching**: Public read routes emit `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`.

### 2. Mutation-Triggered Targeted Invalidation
- When administrative changes occur in `AdminUtilitiesService` or `AdminAdsService`, targeted keys are deleted by prefix (`invalidatePrefix` / `invalidateCache`), ensuring zero stale data reads on subsequent requests.
- Broad destructive `FLUSHALL` commands are strictly forbidden in application code.

### 3. Fail-Open High Availability
- If Redis becomes unavailable, all caching layers seamlessly fail open to PostgreSQL queries without dropping requests or crashing the server.

### 4. Non-Blocking Async Persistence
- Ad impressions, clicks, analytics events, and AI telemetry records are persisted asynchronously with `.catch(...)` error boundaries, preserving low user latency.

### 5. Architectural Simplicity & Infrastructure Boundaries
- Heavier infrastructure (Kubernetes, Kafka, PgBouncer, microservices) is deliberately omitted as current single-container architecture delivers P50 latencies < 10ms for public APIs.

## Consequences
- **Positive**: P50 latencies < 10ms on public read endpoints, instant cache invalidation upon admin changes, full resilience under Redis failure.
- **Negative**: Redis memory footprint bounded by TTLs (eviction policies managed via Redis standard `volatile-lru`).
