# ADR-013: Production Launch & Monetization Readiness

## Status
**ACCEPTED / IMPLEMENTED** (Phase 13)

## Date
2026-09-08

---

## Context
Following the completion and freezing of Phases 0 through 12, the platform reached application-level production readiness (170 automated tests, hardened security, database baseline resolved, Docker configurations complete).

However, the Phase 13 read-only audit revealed critical launch-time blockers:
1. **Public API Origin:** Client-side components (`ad-slot.tsx`, `analytics.ts`, `admin-api.ts`, utility workspaces) defaulted to hardcoded `http://localhost:4000/api/v1` or `http://localhost:4001/api/v1`, which is completely non-functional for real browser clients accessing a public domain.
2. **House / Fallback Ads:** All 8 configured placements required verified fallback behavior so that unbooked or non-matching placements do not cause Cumulative Layout Shift (CLS), broken layouts, or uncaught client errors.
3. **Automated Launch Smoke Testing:** No single script existed to verify the full user journey and monetization pipeline (Landing → Category → Tool → Ad Slot → Impression → Click → Analytics Funnel → Auth).
4. **Privacy & SEO Launch Checklists:** Necessary cookies, IP/UA hashing, telemetry data retention, and external search engine indexing verification needed formal operational documentation.

---

## Decisions

### 1. Centralized Client-Side API Origin Resolver
We established a single authoritative function `getClientApiUrl()` in `apps/frontend/src/lib/site-config.ts`:
- In browser environments (`typeof window !== 'undefined'`), if `NEXT_PUBLIC_API_URL` is set, it is used with trailing slashes stripped; otherwise, it defaults to same-origin `/api/v1`.
- This ensures production deployments behind a reverse proxy (e.g., Nginx, Cloudflare, Traefik) map `/api/v1/*` cleanly to the backend container without requiring cross-origin CORS or exposing localhost.
- Server-side calls continue to resolve safely to backend endpoints.

### 2. Dual-Layer Fallback Ad Strategy
- Placements with active house campaigns (such as `AFTER_TOOL` backed by `Global Fallback Campaign`) deliver verified fallback creatives with signed tracking tokens across all categories.
- Placements without active campaigns return a clean `hasAd: false` (`TIER_5_NO_AD`). The `<AdSlot />` component handles this by rendering `null`, preventing visual defects or layout shifts.
- Fake commercial advertisers or fabricated revenue figures are strictly forbidden.

### 3. Cross-Platform Automated Launch Smoke Test
We implemented both `scripts/launch-smoke-test.ps1` (PowerShell for Windows) and `scripts/launch-smoke-test.sh` (POSIX Bash for Linux/CI):
- Performs 16 automated end-to-end health, SEO, tool execution, ad delivery, tracking, and RBAC checks against running containers.
- Generates reproducible exit codes (0 = 100% pass, 1 = failure) suitable for CI/CD gates.

### 4. Zero-Persistence Utility Processing & Privacy Disclosure
- We codified our privacy architecture in `docs/privacy-data-handling.md`.
- All utility inputs and outputs (text, images, PDFs) are processed strictly in volatile Node.js process memory and garbage collected immediately upon request completion. 0 bytes are persisted to disk or database.
- IP addresses and User-Agents are irreversibly hashed using SHA-256 before telemetry storage.
- Session tokens are stored in browser `sessionStorage` and destroyed on tab closure.

### 5. Deferral of Real OpenAI & Third-Party Ad Networks
- **Real OpenAI Integration:** Strictly deferred. No `OPENAI_API_KEY` is present. Deterministic mock providers handle `ai-humanizer`, `ai-paraphraser`, and `ai-grammar-checker`.
- **Third-Party Ad Networks:** Strictly deferred. No external ad scripts or programmatic ad exchanges (Google AdSense, Prebid) are loaded.

---

## Consequences

### Positive
- **Production Browser Compatibility:** Public users can access tools, receive ads, and submit analytics seamlessly via same-origin reverse proxy without CORS issues or localhost errors.
- **Visual Stability:** Zero CLS on unbooked placements.
- **Verification Certainty:** 183 automated backend tests across 12 suites (100% passing) + 16 smoke tests (100% passing) provide comprehensive deployment confidence.
- **Compliance Readiness:** Transparent privacy disclosure documents zero file persistence and irreversible IP hashing.

### Trade-offs & Operational Requirements
- External domain mapping, public DNS, and SSL certificate issuance must be configured by human operators at the reverse proxy layer (`DOCUMENTED / NOT VERIFIED`).
- Search engine indexing requires manual submission to Google Search Console and Bing Webmaster Tools per `docs/search-engine-launch-checklist.md`.
- Activating real OpenAI or third-party ad networks in future phases will require dedicated architectural reviews and CMP implementation.
