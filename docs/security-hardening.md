# Security Hardening & Platform Protection Guide

## 1. Executive Summary & Threat Model

The Utility + Ad Platform operates in a multi-tenant, untrusted internet environment where users execute client-side and server-side utilities, view and interact with first-party ad creatives, and submit telemetry. Administrative users manage access controls, campaigns, and platform settings.

### System Architecture Flow

```text
       Internet User / Public Client
                     ↓
         Next.js Frontend (Edge SSR)
       [Security Headers, CSP, No-XPB]
                     ↓
            NestJS REST API
  [Global Filters, DTO Validation, CORS]
                     ↓
 ┌───────────────────┼───────────────────┐
 ↓                   ↓                   ↓
PostgreSQL         Redis               File Processors
(Prisma ORM,   (Sliding Window,     (Magic Bytes, Size,
Parameterized)  Fail-Open Cache)    Path Sanitization)
 ↓
Admin Panel & RBAC
(SUPER_ADMIN / ADMIN / EDITOR / ANALYST)
```

### Threat Categories & Concrete Mitigations

| Threat Vector | Potential Impact | Implemented Mitigation |
| :--- | :--- | :--- |
| **Unauthenticated Abuse** | Unauthorized data access or mutations | Global JWT AuthGuard rejecting requests missing or invalid tokens (`401 Unauthorized`). |
| **Privilege Escalation** | Lower roles (Analyst/Editor) modifying admin settings or users | Granular `RolesGuard` and `PermissionsGuard` checking declarative permissions (`403 Forbidden`). |
| **Malicious File Uploads** | Remote code execution, polyglot payloads, reverse shells | Binary magic-byte signature validation for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and PDF (`%PDF-`), strictly rejecting executables (MZ/ELF) and invalid files. |
| **Oversized Payloads** | Server memory exhaustion / DoS | Enforced body-parser size limits (60MB) and per-adapter file boundaries (15MB images, 25MB PDFs). |
| **Path Traversal** | Arbitrary file read/write on host | `sanitizeFilename` stripping null bytes, directory traversal sequences (`..`, `/`, `\`), and constraining output to safe character sets. |
| **SQL Injection** | Database leakage or unauthorized mutation | 100% parameterized queries via Prisma ORM; zero unescaped raw SQL. |
| **Command Injection** | Server process compromise | No usage of `child_process.exec`, `spawn`, or shell execution with user input. |
| **Cross-Site Scripting (XSS)** | Admin session hijacking or client compromise via ad creatives | `validateHtmlSafety` validator stripping `<script>` tags, inline event handlers (`onload`, `onerror`), and `javascript:` URIs from custom HTML creatives. |
| **Ad Tracking Token Forgery** | Fabricated impressions or fraudulent click generation | HMAC-SHA256 tracking token verification with 24-hour expiration window; forged tokens are rejected or discarded. |
| **Information Disclosure** | Leakage of stack traces, database schema, or internal paths | `GlobalExceptionFilter` intercepting all unhandled runtime errors and returning scrubbed generic 500 envelopes without stacks. |
| **Clickjacking & Sniffing** | UI redress attacks or MIME confusion | Standard security headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, removal of `X-Powered-By`). |

---

## 2. Authentication & Authorization Security

### 2.1 Password Security & Brute-Force Prevention
- Passwords are encrypted with bcrypt (work factor 10).
- Login failures return a unified generic message (`Invalid email or password`) to prevent email/account enumeration attacks.
- Deactivated user accounts (`isActive: false`) are blocked at credential verification with `403 Forbidden`.

### 2.2 JWT Token Lifecycle
- Stateless access tokens signed with HMAC-SHA256 (`JWT_SECRET`, min 32 chars).
- Strict token expiration enforcement; expired or forged tokens signed with attacker keys return `401 Unauthorized`.
- Separate refresh token secret (`JWT_REFRESH_SECRET`) and independent lifecycle validation.

### 2.3 RBAC Hierarchy & Object Authorization
- Standard roles: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST`.
- `SUPER_ADMIN` retains unconditional administrative access across all protected endpoints.
- Role-restricted routes apply `@Roles()` and `@RequirePermissions()` decorators.
- Horizontal/vertical privilege escalation attempts (e.g., ANALYST attempting to create users or EDITOR attempting to patch system settings) are rejected with `403 Forbidden`.

---

## 3. Input Validation & Request Size Limits

### 3.1 DTO Enforcement
- NestJS `ValidationPipe` is registered globally with:
  - `whitelist: true`: Discards non-whitelisted payload properties.
  - `forbidNonWhitelisted: true`: Immediately rejects payloads containing unknown/unauthorized fields with `400 Bad Request`.
  - `transform: true`: Strongly types numbers, booleans, and nested DTOs.

### 3.2 Request Size Restrictions
- JSON and URL-encoded request bodies are capped at 60MB to support valid document/image utility conversions while rejecting unbounded payloads.
- Utility adapters enforce localized binary size limits:
  - Image conversions: 15MB maximum.
  - PDF operations: 25MB maximum.

---

## 4. File Upload & Processing Security

### 4.1 Magic Byte Signature Verification
Never rely on file extensions or client-sent `Content-Type` headers. All server-side file adapters inspect the raw binary header:
- **JPEG**: Requires `0xFF 0xD8 0xFF`.
- **PNG**: Requires `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`.
- **PDF**: Requires `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`) in the first 1024 bytes and actively rejects Windows PE executables (`MZ`) and Linux ELF binaries.

### 4.2 Filename Sanitization & Path Traversal Prevention
- `sanitizeFilename(input)` strips null bytes (`\x00`), control characters, directory traversal sequences (`..`, `/`, `\`), and collapses consecutive dots.
- Constrains names to alphanumeric characters, underscores, hyphens, and dots, bounded to 100 characters.

---

## 5. Ad Engine & Analytics Abuse Prevention

### 5.1 Ad Tracking Tokens
- Impression and click tracking URLs use encrypted, tamper-evident HMAC-SHA256 tracking tokens containing creative ID, campaign ID, placement ID, and a timestamp.
- Expired tokens (>24h) and forged tokens are immediately rejected with `400 Bad Request` (clicks) or discarded (impressions) without recording.

### 5.2 Ad Creative HTML Sanitization
- Administrative ad creative creation and updates enforce `validateHtmlSafety()`.
- Explicitly blocks `<script>`, `</script>`, inline DOM event handlers (e.g., `onerror=`, `onload=`, `onclick=`), and `javascript:` URIs.

### 5.3 Analytics Telemetry Abuse
- In-memory and Redis-backed sliding window rate limiters prevent event flooding.
- Analytics deduplication filters out duplicate events based on deterministic `eventId`.

---

## 6. HTTP Security Headers & Information Disclosure

### 6.1 Backend Headers (NestJS)
- `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing exploits.
- `X-Frame-Options: SAMEORIGIN`: Prevents cross-origin clickjacking Redress attacks.
- `X-XSS-Protection: 1; mode=block`: Activates browser reflected XSS filters.
- `Referrer-Policy: strict-origin-when-cross-origin`: Restricts referrer data leakage.
- `X-Powered-By`: Explicitly disabled to prevent framework fingerprinting.

### 6.2 Frontend Headers (Next.js)
- Configured in `next.config.mjs` for all routes (`/:path*`).
- Adds `Permissions-Policy: camera=(), microphone=(), geolocation=()` to disable unnecessary hardware APIs.
- `poweredByHeader: false`: Strips `X-Powered-By: Next.js`.

### 6.3 Global Exception Scrubbing
- `GlobalExceptionFilter` masks internal database errors, query strings, and system stack traces.
- Client responses contain a clean, standardized envelope (`statusCode`, `message`, `error`, `timestamp`, `path`).

---

## 7. Resilience & Graceful Degradation

### 7.1 Redis Fail-Open Caching
- Public utility and category reads are wrapped in defensive `try...catch` blocks.
- If Redis is unavailable or drops connection, the cache layer logs a warning and falls back silently to PostgreSQL without crashing or returning HTTP 500.

### 7.2 Missing Adapter Handling
- If a database record exists for a utility but the corresponding code adapter is not registered in the runtime registry, the server responds with a controlled `503 Service Unavailable` instead of throwing an unhandled runtime error.

---

## 8. Dependency Security & Audit Summary

A full production dependency audit (`pnpm audit --prod`) was performed:
- Total vulnerabilities identified: 19 (1 low, 11 moderate, 7 high).
- Root cause: Transitive dependencies within `@nestjs/platform-express` (`express`, `body-parser`, `qs`, `multer`) and `@nestjs/swagger` (`js-yaml`).
- Risk assessment: Transitive dependencies do not expose unvalidated input parsing paths. Direct upgrades would break framework peer dependency trees. Upgrades deferred to major framework synchronization in Phase 12.

---

## 9. AI Integration Status

- **Real OpenAI / External Provider Integration**: **STRICTLY DEFERRED**.
- No `OPENAI_API_KEY` exists in environment files, Docker configs, or CI/CD pipelines.
- Mock/deterministic AI provider remains functional and secure with rate limiting and usage accounting.
