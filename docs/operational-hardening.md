# Operational Hardening & Production Observability Guide

## 1. System Architecture & Component Roles

The **Utility + Ad Platform** operates as a high-performance single-domain monorepo consisting of:
- **Frontend App Router (Next.js 14 / React 18)**: Public utility tool shell, SEO category hubs, non-blocking `<AdSlot />` components, and Admin Control Panel.
- **Backend Core (NestJS / Node.js 20)**: Modular REST API providing Hybrid Utility Engine, 12-step Ad Selection Engine, Centralized AI Gateway, and First-Party Analytics.
- **Data Persistence (PostgreSQL 16 via Prisma ORM)**: Relational schema for RBAC, campaigns, creatives, targeting rules, utilities metadata, and telemetry logs.
- **High-Speed Cache & In-Memory Store (Redis 7)**: Ad slot response caching, frequency capping counters, analytics deduplication, and utility catalog caching.

---

## 2. Request Correlation & Tracing (`X-Request-Id`)

Every request traversing the platform is assigned a unique correlation ID:
1. **Header Resolution**:
   - The server inspects `X-Request-Id` or `X-Correlation-Id`.
   - Incoming values are sanitized (alphanumeric and dashes, max 64 characters) to prevent header injection.
   - If missing or invalid, a standard `UUIDv4` is automatically generated.
2. **Context Propagation**:
   - Stored in `req.headers['x-request-id']` and `req.id`.
   - Added as a response header: `X-Request-Id: <id>`.
   - Propagated through `UtilitiesService.executeUtility(...)` and returned in `UtilityExecutionResponseDto.requestId`.
   - Attached to all error responses (`GlobalExceptionFilter`) for instant client-to-log correlation.

---

## 3. Structured & Privacy-Preserving Logging

All HTTP traffic and critical subsystems use structured logging format:
`[requestId] [METHOD] [URL] [STATUS] - [durationMs]ms - [Context]`

### Privacy & Sanitization Rules:
- **No Secret Values**: `OPENAI_API_KEY`, `JWT_SECRET`, database connection strings, and authorization tokens are strictly filtered and never printed.
- **No Raw Payloads**: Input prompts, AI completions, uploaded document bytes, and base64 strings are never logged.
- **IP Anonymization**: IP addresses are hashed using SHA-256 with optional session salt before telemetry persistence.

---

## 4. Observability Probes & Health Semantics

| Probe Endpoint | Target Purpose | Dependency Semantics | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/health` | Service ping & environment check | Process status | `200 OK` |
| `GET /api/v1/health/liveness` | Kubernetes / Container vitality | Node process uptime | `200 OK` |
| `GET /api/v1/health/readiness` | Traffic readiness check | PostgreSQL (Required, Fail-Closed) + Redis (Fail-Open) | `200 OK` (ready/degraded), `503 Service Unavailable` (DB drop) |

---

## 5. Resilience & Fail-Open Policies

### PostgreSQL Database (Required / Fail-Closed):
- Connection drops immediately mark `/health/readiness` as `503 Service Unavailable`.
- Unhandled SQL exceptions are captured by `GlobalExceptionFilter` and masked as safe `500 Internal Server Error` with `requestId`.

### Redis In-Memory Store (Fail-Open):
- **Ad Slot Caching**: If Redis is offline, requests fall back to direct PostgreSQL query selection.
- **Ad Frequency Capping**: If Redis is offline, frequency cap checks allow delivery to prevent revenue loss.
- **Analytics Deduplication**: If Redis is offline, telemetry ingestion continues without in-memory deduplication.
- **Utility Metadata Caching**: If Redis is offline, queries fall back directly to PostgreSQL.
- **AI Rate Limiting**: If Redis is unreachable, local in-memory fallback rate limiting applies.

---

## 6. Resource Limits & Execution Protections

| Layer | Limit / Threshold | Protection Rationale |
| :--- | :--- | :--- |
| **Express Body Parser** | 70MB JSON & URL-encoded | Permits base64 payloads to reach inner adapter guards |
| **Image Converters** | 15MB file limit, magic-byte verification | Rejects non-JPEG/PNG payloads before processing |
| **PDF Tools** | 20MB–50MB file limits, %PDF- header check | Prevents memory exhaustion during merge/split |
| **PDF to JPG Rasterizer** | Max 20 pages per batch, scale clamp [0.5, 3.0] | Protects CPU/memory during canvas rasterization |
| **Execution Timer** | 10s–25s timeout with `RequestTimeoutException` | Cancels hanging tasks and frees event loop |
| **AI Prompt Limits** | Max 50,000 characters | Prevents token runaway |

---

## 7. Graceful Shutdown Procedures

On receipt of `SIGTERM` or `SIGINT`:
1. NestJS shutdown hooks (`app.enableShutdownHooks()`) trigger lifecycle handlers.
2. In-flight HTTP requests are given bounded time to complete.
3. `PrismaService.onModuleDestroy()` cleanly disconnects PostgreSQL connections (`$disconnect()`).
4. `RedisAdCacheService.onModuleDestroy()` cleanly disconnects Redis socket client (`disconnect()`).
5. Process terminates cleanly with exit code 0.
