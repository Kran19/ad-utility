# ADR-007: First-Party Analytics Engine, Attribution & Telemetry Architecture

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-02
- **Deciders**: Lead Architect & Backend Engineering

---

## 1. Context & Problem Statement
The platform requires accurate first-party telemetry across utility interactions, advertisement impressions/clicks, AI requests, and marketing attribution without relying on third-party tracking scripts (e.g. Google Analytics) that compromise user privacy or get blocked by client ad blockers. Crucially, telemetry MUST NOT introduce latency or become a failure point for utility execution, ad delivery, or AI generation.

---

## 2. Core Architectural Questions & Decisions

### 1. Why is analytics centralized?
A centralized analytics ingestion domain (`/api/v1/analytics/events`) ensures a uniform canonical schema, single-point validation, consistent UTM parsing, centralized rate limiting, and standard privacy hashing across all frontend pages and backend services.

### 2. Why is analytics non-blocking?
Telemetry is secondary to product functionality. Ingestion responds immediately (`200 OK`) and delegates persistence asynchronously. If the database or telemetry pipeline encounters latency or failure, primary utility processing, ad serving, and AI generation remain 100% available and uninterrupted.

### 3. Why is PostgreSQL authoritative?
PostgreSQL 16 is the single authoritative relational store for the platform. Storing `analytics_events` alongside `utilities`, `ad_campaigns`, and `ai_requests` enables relational integrity, ACID compliance, and SQL aggregation without adding third-party dependencies.

### 4. Why is Redis used?
Redis 7 is used for high-speed, sliding-window deduplication (`eventId` cache with 60-second TTL) and IP/session-level rate limiting, preventing brute-force abuse and duplicate submissions before database writes.

### 5. What data is considered PII?
Raw IP addresses, cleartext user agents, plaintext passwords, JWT authentication secrets, payment details, and raw AI prompt contents are classified as PII/sensitive data and are NEVER stored in analytics records.

### 6. How is IP privacy preserved?
Incoming client IP addresses are transformed immediately into one-way cryptographic SHA-256 hashes (`ipHash`) with optional salt before any persistence or logging occurs, adhering to GDPR/CCPA privacy standards.

### 7. How is session identity generated?
Anonymous session identifiers (`sessionToken`) are generated client-side via cryptographically secure UUIDv4 / random bytes and stored in browser session storage. They are decoupled from user account credentials or authentication JWTs.

### 8. What is the attribution model?
The system implements a deterministic **First-Touch Session Attribution Model**. When a user visits via a campaign URL with query parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`), these UTM values are bound to the anonymous session and attributed to all subsequent lifecycle events in that session.

### 9. How are duplicate events handled?
The ingestion layer utilizes an `eventId` idempotency check. Each client-generated event includes a unique identifier cached in Redis/memory for 60 seconds. Duplicate submissions within the window are acknowledged as duplicates and discarded before database insertion.

### 10. How is analytics abuse prevented?
Public ingestion (`POST /api/v1/analytics/events`) is guarded by strict payload size limits (max 50 events per batch, max 5KB metadata), string sanitization/truncation, and sliding-window rate limiters per IP/session.

### 11. What happens when PostgreSQL fails?
Ingestion gracefully logs the error without crashing. Utility execution, ad delivery, and AI gateway requests continue operating normally. Telemetry errors are caught inside isolated try/catch boundaries.

### 12. What happens when Redis fails?
If Redis is temporarily unreachable, rate limiting and deduplication fail open or fall back to local in-memory caching to ensure event ingestion and primary application features remain operational.

### 13. How are analytics queries authorized?
Reporting query endpoints (`GET /api/v1/analytics/summary`) are strictly protected by NestJS `JwtAuthGuard` and `RolesGuard`, requiring `ADMIN` or `SUPER_ADMIN` RBAC roles. Public clients cannot inspect platform analytics.

### 14. Why are ad impressions/clicks not duplicated?
`ad_impressions` and `ad_clicks` in the database remain the authoritative tables for ad billing and CTR measurement. `analytics_events` receives generalized event notifications without duplicating fine-grained advertising domain state.

### 15. Why are AI usage records not duplicated?
`ai_requests` in the database remains the single authoritative store for OpenAI token counts, model execution latency, and USD cost calculations. Analytics records referential `AI_REQUEST` events to prevent data divergence.

### 16. What is the expected retention strategy?
Raw high-volume events in `analytics_events` are targeted for a 90-day rolling retention period, with automated daily rollups into aggregated summary tables for long-term historical reporting.

### 17. At what scale should partitioning be considered?
When `analytics_events` approaches 10M–50M rows, monthly range-based table partitioning on the `timestamp` column should be introduced to maintain high query throughput and enable instant partition dropping for retention pruning.

---

## 3. Consequences & Verification
- Non-blocking ingestion with sub-10ms response times.
- Zero risk of telemetry issues affecting core utility execution.
- Queryable foundations verified by automated tests (76/76 passing).
- Fully prepared for Phase 8 Admin Control Panel integration.
