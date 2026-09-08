# ADR-011: Automated Testing & Security Hardening Architecture

## Status
Approved / Frozen

## Context
The Utility + Ad Platform platform was fully built and feature-verified through Phases 0 to 10, achieving 128 passing baseline tests and a healthy containerized runtime. In Phase 11, the objective is to systematically harden the platform against abuse, exploitation, malformed payloads, injection, privilege escalation, and unexpected operational failures without redesigning existing architectural foundations.

## Decision Drivers
1. Strict defense-in-depth across both NestJS backend API and Next.js frontend edge SSR.
2. Prevention of sensitive data leakage (SQL statements, internal paths, stack traces).
3. Resilient file processing against corrupted images, malformed PDFs, and disguised binaries.
4. Prevention of privilege escalation (horizontal and vertical) across the admin control plane.
5. Strict preservation of the frozen baseline: 128/128 tests passing + new security suites = 100% passing.
6. Absolute AI constraint: Real OpenAI integration remains strictly deferred (no API key, zero external calls).

## Decisions

### 1. Global Exception Filtering & Information Scrubbing
- Implemented `GlobalExceptionFilter` in `apps/backend/src/common/filters/global-exception.filter.ts`.
- Standard NestJS HTTP exceptions retain their controlled status codes and client-friendly messages.
- Unexpected internal server errors (e.g. database query errors, unhandled runtime exceptions) are logged internally with full stack traces, but masked in client responses with a generic 500 (`An unexpected internal error occurred`), completely suppressing stack traces and SQL query strings.

### 2. HTTP Security Headers & Fingerprint Removal
- Backend (`main.ts`):
  - Disabled `x-powered-by` via `app.getHttpAdapter().getInstance().disable('x-powered-by')`.
  - Added security headers middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- Frontend (`next.config.mjs`):
  - Added async `headers()` mapping security headers to all paths (`/:path*`).
  - Set `poweredByHeader: false` to strip `X-Powered-By: Next.js`.
  - Configured `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### 3. Magic-Byte Binary Verification & Filename Sanitization
- Extended `buffer-utils.ts`:
  - `validateJpegMagicBytes`: Enforces `0xFF 0xD8 0xFF`.
  - `validatePngMagicBytes`: Enforces PNG 8-byte magic header.
  - `validatePdfMagicBytes`: Searches first 1024 bytes for `%PDF-` and actively detects/rejects Windows PE executable headers (`MZ`) and Linux ELF binaries.
  - `sanitizeFilename`: Strips null bytes (`\x00`), control characters, directory traversal sequences (`..`, `/`, `\`), collapses dots, and bounds name length to 100 characters.

### 4. Custom HTML Ad Creative Sanitization
- In `AdminAdsService`, introduced `validateHtmlSafety()`:
  - Rejects custom HTML banners containing `<script>`, `</script>`, inline DOM event handlers (`onerror=`, `onload=`, `onclick=`), or `javascript:` URI schemes.
  - Returns controlled `BadRequestException` on violation.

### 5. Redis Cache Fail-Open Strategy
- In `UtilitiesService`, wrapped all `cache.get()` and `cache.set()` operations in defensive `try...catch` blocks.
- If the Redis connection drops, the application logs a warning and falls back directly to PostgreSQL, preventing cascading service outages.

### 6. Automated Testing Expansion
- Created `apps/backend/test/security-hardening.spec.ts` containing 34 automated security and resilience assertions across 8 functional groups:
  1. Authentication & token security (7 tests).
  2. Authorization & privilege escalation prevention (4 tests).
  3. DTO input validation & non-whitelisted property rejection (3 tests).
  4. File upload & magic byte enforcement (6 tests).
  5. Injection & XSS defense (4 tests).
  6. Rate limiting & telemetry abuse prevention (5 tests).
  7. Security headers & information disclosure (3 tests).
  8. Resilience & graceful degradation (2 tests).

## Consequences
- Total test count expanded from 128 baseline tests to 162 total tests across 10 test suites (100% passing).
- Zero breaking changes to public utility APIs or legitimate ad delivery flows.
- Production dependency audit documented: 19 transitive vulnerabilities in `@nestjs/platform-express` and `@nestjs/swagger` evaluated and prioritized for Phase 12 framework upgrades.
- Real OpenAI integration remains completely deferred.
