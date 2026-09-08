# ADR-016: Production Stability, Observability & Operational Hardening Architecture

## Status
ACCEPTED / FROZEN

## Date
2026-09-08

## Context
As the Utility + Ad Platform advances toward public production deployment, high-concurrency traffic and external failure modes (such as Redis disconnects, database timeouts, or malformed user inputs) require rigorous operational hardening. 

The emergency regression resolved in post-Phase-13 demonstrated that shared request lifecycles, execution timers, body-size limits, and error observability must be architected with clear fail-open vs fail-closed boundaries, correlation tracing, and error sanitization.

## Decisions

### 1. Unified Request Correlation (`X-Request-Id`)
- Every HTTP request receives a sanitized or freshly generated `UUIDv4` correlation ID via `RequestIdMiddleware`.
- The correlation ID is included in server logs, response headers (`X-Request-Id`), error payloads (`GlobalExceptionFilter`), and utility execution responses (`UtilityExecutionResponseDto.requestId`).

### 2. Structured & Privacy-Preserving Logging
- `LoggingInterceptor` records request method, URL, status code, duration, and `requestId` on every endpoint.
- Zero raw user payloads, passwords, JWTs, API keys, or raw IP addresses are logged.

### 3. Clear Dependency Failure Semantics
- **PostgreSQL**: Classified as **REQUIRED / FAIL-CLOSED**. If unreachable, `GET /api/v1/health/readiness` fails with HTTP 503 to alert load balancers.
- **Redis**: Classified as **FAIL-OPEN**. If unreachable, caching, frequency capping, and analytics deduplication fail open, preserving core utility execution and ad delivery.

### 4. Bounded Execution & Resource Guards
- Express body parser configured with a 70MB ceiling to allow base64 file payloads to reach adapter-level guards.
- Per-adapter magic-byte validation and byte-count guards enforce strict limits (15MB images, 20MB PDFs, max 20 pages rasterization).
- Execution timers enforce maximum execution bounds (10s–25s) via `RequestTimeoutException`.

### 5. Graceful Process Termination
- `app.enableShutdownHooks()` triggers `onModuleDestroy` on `PrismaService` and `RedisAdCacheService`, cleanly closing client sockets without abrupt disconnection.

### 6. AI Subsystem Constraint
- Real OpenAI integration remains deferred (`AI_PROVIDER=mock`). Zero external provider requests or API keys are required.

## Consequences
- **Positive**: Complete end-to-end request traceability, sanitized public error responses, resilient degraded operation under Redis outages, and zero resource leaks.
- **Negative**: Minor logging overhead (sub-millisecond per request) handled asynchronously by Node.js streams.
