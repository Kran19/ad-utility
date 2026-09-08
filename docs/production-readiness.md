# Production Readiness & Deployment Guide

## 1. Executive Summary & Production Topology

This document establishes the operational standard, security controls, and deployment architecture for the **Utility + Ad Platform** in production environments.

### Production Topology Diagram

```text
                               Public Internet
                                      │
                                      ▼
                        Edge Ingress / Reverse Proxy
                      (Cloudflare / AWS ALB / NGINX)
                        [SSL Termination, DDoS, WAF]
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        Next.js Frontend (SSR)                  NestJS Backend API
        Port 3000 (Internal)                   Port 4000 (Internal)
        Container: ad_utility_frontend         Container: ad_utility_backend
        Alpine Multi-Stage                     Alpine Multi-Stage
        Non-root (node:node)                   Non-root (node:node)
                   │                                     │
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                       ad_utility_prod_network (Isolated)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
         PostgreSQL 16 Engine                   Redis 7 In-Memory
         Port 5432 (Unexposed)                 Port 6379 (Unexposed)
         Container: ad_utility_postgres        Container: ad_utility_redis
         WAL Archiving & Backups               256MB LRU Cache / Throttling
```

---

## 2. Environment Configuration & Secret Management

### Production Environment Variables

| Variable | Scope | Production Setting | Security Requirement |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | All | `production` | Enables Express/Next optimizations, disables verbose stacks |
| `DATABASE_URL` | Backend | `postgresql://prod_user:***@postgres:5432/ad_utility_prod?sslmode=prefer` | Must use dedicated database user with strong credential |
| `REDIS_URL` | Backend | `redis://:***@redis:6379/0` | Protected Redis instance with requirepass enabled |
| `JWT_SECRET` | Backend | Min 64-char random string | Rotated quarterly; never committed to git |
| `JWT_REFRESH_SECRET` | Backend | Min 64-char random string | Distinct from `JWT_SECRET` |
| `HMAC_TRACKING_SECRET` | Backend | Min 64-char random string | Signs ad impressions and click tokens |
| `FRONTEND_URL` | Backend | `https://example.com` | Strict CORS origin enforcement |
| `NEXT_PUBLIC_API_URL` | Frontend | `https://api.example.com` or `https://example.com/api/v1` | Public API endpoint for browser calls |
| `NEXT_PUBLIC_APP_URL` | Frontend | `https://example.com` | Canonical URL generator baseline |
| `PORT` | Backend | `4000` | Internal container port |
| `PORT` | Frontend | `3000` | Internal container port |

> [!IMPORTANT]
> **OpenAI Key Policy**: `OPENAI_API_KEY` is **strictly deferred** and MUST NOT be set in production environments. The platform startup validation explicitly verifies that the absence of an OpenAI key does not prevent bootstrapping, allowing all image, PDF, text, and mock AI utilities to function smoothly.

---

## 3. Container Production Hardening & Network Isolation

### Production Compose Hardening (`docker-compose.prod.yml`)
1. **Zero Host Exposure of Data Stores**:
   - `ad_utility_postgres` and `ad_utility_redis` do NOT expose ports (`5432` or `6379`) to host interfaces.
   - Access is restricted exclusively to internal container-to-container communication over `ad_utility_prod_network`.
2. **Container Security Context**:
   - Containers run as the unprivileged `node` user (`UID 1000, GID 1000`).
   - Read-only root filesystems where applicable, with `/tmp` mounted for file buffering.
3. **Resource Ceilings**:
   - Redis configured with memory limit: `--maxmemory 256mb --maxmemory-policy volatile-lru`.
   - Docker container memory and CPU reservations prevent noisy-neighbor degradation.
4. **Health Checks**:
   - Native container-level healthchecks run every 15–30 seconds.
   - Stateful containers (Postgres, Redis) test readiness with native utilities (`pg_isready`, `redis-cli ping`).
   - Application containers test endpoints with `curl` or `wget`.

---

## 4. Database Operations & Migration Protocol

### Migration Strategy: `prisma migrate deploy`
In production, running `prisma db push` or `prisma migrate dev` is strictly prohibited.
All schema changes follow an immutable migration pipeline:

```bash
# Production migration execution in CI/CD or release container:
pnpm --filter @ad-utility/backend prisma:deploy
# Executes: prisma migrate deploy
```

### Migration Safety Rules
- **No Destructive Drops**: Migrations must not drop columns in the same release that code stops reading them (two-phase rollout).
- **Migration Status Check**:
  ```bash
  npx prisma migrate status
  ```
- **Baseline Verification**: The initial schema is codified in `_prisma_migrations` (`20260902102816_init_phase2_database_architecture`).

---

## 5. Disaster Recovery & Backup/Restore Automation

### Automated Recovery Scripts
The repository provides production-tested backup and restore automation scripts:

| Script | Platform | Purpose |
| :--- | :--- | :--- |
| `scripts/backup-db.sh` | Linux / POSIX | Creates gzip-compressed `pg_dump` with metadata header |
| `scripts/restore-db.sh` | Linux / POSIX | Drops/creates target database and restores from gzipped dump |
| `scripts/backup-db.ps1` | Windows PowerShell | Windows automated backup generation |
| `scripts/restore-db.ps1` | Windows PowerShell | Windows automated database restore |

### Backup Verification Drill Summary
- **Tested Target**: Disposable database `ad_utility_restore_test`.
- **Integrity Validation**: All 18 relational tables and exact row counts verified:
  - Total utilities: 26 (including all 12 Phase 9 MVP tools).
  - Total users: 11 (including seed RBAC roles).
  - Total categories: 5.
- **RTO / RPO Targets**:
  - **Recovery Time Objective (RTO)**: < 5 minutes.
  - **Recovery Point Objective (RPO)**: 1 hour (via hourly automated cron dumps to S3/GCS).

---

## 6. Observability, Health Probes & Request Tracing

### Split Probes Architecture

```text
           Load Balancer / Kubernetes Orchestrator
                     │                      │
       Liveness Check│                      │Readiness Check
       (Every 10s)   │                      │(Every 5s)
                     ▼                      ▼
         /api/v1/health/liveness    /api/v1/health/readiness
         [Uptime, Process State]    [DB Query: SELECT 1]
                     │                      │
            Returns 200 OK         200 OK / 503 Unavailable
        (Never fails on DB drop)   (Removes from traffic pool)
```

1. **Liveness Probe (`/api/v1/health/liveness`)**:
   - Response: `{"success":true,"data":{"status":"alive","uptimeSeconds":142,"timestamp":"..."}}`
   - Purpose: Verifies the Node.js event loop is responsive. Never connects to external stateful dependencies.
2. **Readiness Probe (`/api/v1/health/readiness`)**:
   - Response: `{"success":true,"data":{"status":"ready","database":"connected","timestamp":"..."}}`
   - Failure: Returns HTTP 503 Service Unavailable if PostgreSQL connection fails.
3. **Request Correlation Middleware (`X-Request-Id`)**:
   - Every request is tagged with an `X-Request-Id` (UUIDv4) if not supplied by the client.
   - Header is returned in all HTTP responses and injected into logging context for cross-tier log aggregation.
4. **Graceful Shutdown**:
   - `app.enableShutdownHooks()` catches `SIGTERM` and `SIGINT`, finishing active in-flight requests and closing database connections before process exit.

---

## 7. Security Posture & Dependency Audit Findings

### Transitive Vulnerabilities Remediation
Using pnpm overrides, 13 transitive vulnerabilities were eliminated:
- `js-yaml` -> `^4.3.1`
- `lodash` -> `^4.17.24`
- `qs` -> `^6.16.0`
- `body-parser` -> `^1.20.6`
- `file-type` -> `^21.3.2`

### Remaining Vulnerability Analysis (`pnpm audit --prod`)
- **Count**: 6 remaining moderate/high vulnerabilities.
- **Root Cause**: Upstream `@nestjs/platform-express@10.x` dependency on `multer@1.4.5-lts.1` (path traversal / busboy DoS).
- **Compensating Security Controls**:
  1. `buffer-utils.ts` enforces binary magic-byte verification (JPEG, PNG, PDF) prior to parsing.
  2. `sanitizeFilename` eliminates path traversal sequences, null bytes, and control characters.
  3. `GlobalExceptionFilter` traps all payload errors and prevents unhandled server termination.
  4. Global body-parser limits (60MB) restrict memory exhaustion risk.

---

## 8. Operational Capacity, Limits & SLA Guarantees

| Metric | Threshold / Target | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Max Payload Size** | 60 MB Global | NestJS `bodyParser.json({ limit: '60mb' })` |
| **Max Image Upload** | 15 MB | `ImageWorkspace.tsx` + adapter validation |
| **Max PDF Upload** | 25 MB | `PdfWorkspace.tsx` + adapter validation |
| **Rate Limit (Public APIs)**| 100 req / 60s per IP | In-memory / Redis sliding window throttling |
| **Telemetry Rate Limit** | 300 req / 60s per IP | Non-blocking telemetry throttling |
| **Category Cache TTL** | 300 seconds | `UtilitiesCacheService` Redis cache with fail-open fallback |
| **Ad Delivery Latency** | < 25 ms | In-memory campaign targeting & Redis frequency caching |

---

## 9. State of AI Gateway & Providers

- **Status**: Production-ready architecture with offline/mock provider active.
- **Provider Activation**: DEFERRED.
- **Offline Behavior**: The AI Gateway returns deterministic, high-quality transformations for `ai-humanizer`, `ai-paraphraser`, and `ai-grammar-checker`.
- **Audit Logging**: All AI requests record token counts, latency, and prompt hashes in the `AiRequest` PostgreSQL table.
