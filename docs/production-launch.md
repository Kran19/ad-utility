# Production Launch & Operations Runbook

**Version:** 1.0.0  
**Phase:** 13 (Production Launch & Monetization Readiness)  
**Status:** READY FOR PRODUCTION DEPLOYMENT  

---

## 1. Executive Summary & Readiness Gate

The **Utility + Ad Platform** has achieved complete application-level and infrastructure-level readiness across Phases 0 through 13.
- **Automated Test Baseline:** 183/183 passing tests across 12 comprehensive test suites (100% pass rate).
- **Public Smoke Test:** 16/16 verified passing tests (`scripts/launch-smoke-test.ps1`).
- **All Monorepo Builds:** Clean compilation for `@ad-utility/shared`, `@ad-utility/backend`, and `@ad-utility/frontend`.
- **Zero Localhost API Dependencies:** Public browser network requests resolve to same-origin `/api/v1` or configured `NEXT_PUBLIC_API_URL`.
- **Monetization Delivery:** Complete end-to-end flow verified from ad selection, signed tracking token generation, impression recording, and cryptographically verified click attribution.
- **AI Rule:** Real OpenAI integration remains **STRICTLY DEFERRED**. Deterministic mock providers handle all AI utility routes with zero external network dependency.

---

## 2. Status Categorization Standard

In compliance with Phase 13 operational requirements, all capabilities are classified into one of five rigorous status states:

| Status Code | Meaning | Scope |
| :--- | :--- | :--- |
| **VERIFIED** | Tested, executed, and confirmed passing in the running environment with reproducible artifacts. | Code, Docker containers, builds, test suites, API routing, Ad Engine, Analytics, DB migrations. |
| **DOCUMENTED** | Architecturally implemented, configured, and procedural instructions fully specified for operator execution. | Cloud reverse proxy, SSL termination, DNS setup, Webmaster console submissions. |
| **NOT VERIFIED** | Requires external infrastructure or live third-party services not present in local deployment. | Public DNS records, live HTTPS certificates from Let's Encrypt, search engine indexing. |
| **DEFERRED** | Intentionally postponed per project architecture rules. | Real OpenAI API integration, third-party programmatic advertising networks (AdSense/Prebid). |
| **BLOCKED** | Impedes deployment. | **NONE.** All Phase 13 blockers have been resolved. |

---

## 3. Architecture & API Origin Hardening

### The Public API URL Challenge
In development, frontend clients often talk directly to `http://localhost:4000/api/v1`. In production browsers, this fails because the user's browser cannot access the container's private loopback interface.

### The Production Origin Strategy
All client-side components (`<AdSlot />`, `analytics.ts`, `admin-api.ts`, and utility workspaces) utilize the centralized origin resolver:

```typescript
// apps/frontend/src/lib/site-config.ts -> getClientApiUrl()
export function getClientApiUrl(): string {
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
    }
    // Preferred Production Pattern: Same-origin reverse proxy
    return '/api/v1';
  }
  // Server-side default
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
  return `${base.replace(/\/+$/, '')}/api/v1`;
}
```

### Supported Deployment Topologies

```text
Topology A (Preferred): Reverse Proxy / Same-Origin
User Browser ─── HTTPS ───► Cloudflare / Nginx (Port 443)
                                 ├── /*           ──► Frontend (Port 3000)
                                 └── /api/v1/*   ──► Backend (Port 4000)

Topology B: Explicit Public Subdomain
User Browser ───► https://utility.example.com (Frontend)
User Browser ───► https://api.utility.example.com/api/v1 (Backend)
                 (Configured via NEXT_PUBLIC_API_URL="https://api.utility.example.com")
```

---

## 4. Advertising Placements & House Fallback Strategy

The platform defines 8 standard ad placements. In production, unbooked placements must not disrupt user layout or cause Cumulative Layout Shift (CLS).

| Placement Code | Standard Size | Primary Target | Fallback Behavior | Fallback Tier | Layout Safety |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `HEADER_BANNER` | 728x90 / 320x50 | Category Header | Clean Empty State / House Ad | `TIER_5_NO_AD` or House | Zero CLS (container hidden) |
| `TOP_CONTENT` | 728x90 / 468x60 / 320x50 | Above Tool | Device-Targeted House Sponsor | `TIER_1` or `TIER_2` | Fixed aspect reservation |
| `AFTER_TOOL` | 728x90 / 300x250 | Under Tool Output | Global Fallback Campaign | `TIER_4_GLOBAL_FALLBACK` | Safe post-render display |
| `MID_CONTENT` | 728x90 / 300x250 | In-Article Guide | Clean Empty State | `TIER_5_NO_AD` | Collapses gracefully |
| `BOTTOM_CONTENT`| 728x90 / 300x250 | Page Footer | Clean Empty State | `TIER_5_NO_AD` | Collapses gracefully |
| `SIDEBAR` | 300x250 / 160x600 | Desktop Right Rail | Clean Empty State | `TIER_5_NO_AD` | Desktop only; collapsed on mobile |
| `MOBILE_STICKY` | 320x50 | Bottom Mobile Viewport | Clean Empty State | `TIER_5_NO_AD` | Bottom fixed overlay (hidden if no ad) |
| `DESKTOP_STICKY`| 728x90 | Bottom Desktop Viewport| Clean Empty State | `TIER_5_NO_AD` | Bottom fixed overlay (hidden if no ad) |

---

## 5. Launch Smoke Testing Procedure

Automated launch smoke testing scripts are provided for both Unix/Linux (`scripts/launch-smoke-test.sh`) and Windows PowerShell (`scripts/launch-smoke-test.ps1`).

### Running the Smoke Test
```powershell
# Windows
powershell -ExecutionPolicy Bypass -File scripts/launch-smoke-test.ps1 -BaseUrl "http://localhost:3001" -BackendUrl "http://localhost:4001"

# Linux / macOS
chmod +x scripts/launch-smoke-test.sh
./scripts/launch-smoke-test.sh http://localhost:3001 http://localhost:4001
```

### Verified Smoke Test Checklist (16 Checks)
1. `GET /` — Homepage renders 200 OK with title and structured markup.
2. `GET /category/developer` — Category listing renders 200 OK.
3. `GET /json-formatter` — Utility page renders 200 OK.
4. `GET /robots.txt` — Robots exclusion protocol renders with `/admin` disallow.
5. `GET /sitemap.xml` — XML sitemap renders with all 19 public static routes.
6. `GET /api/v1/health` — Backend composite health check returns 200 OK.
7. `GET /api/v1/health/liveness` — Liveness probe returns 200 OK.
8. `GET /api/v1/health/readiness` — Readiness probe validates DB and Redis connectivity.
9. `POST /api/v1/utilities/execute/case-converter` — Utility engine processes input text.
10. `POST /api/v1/ads/slot` — Ad Engine delivers valid creative with signed tracking token.
11. `POST /api/v1/ads/impression` — Ad Engine records impression with valid token.
12. `POST /api/v1/ads/click` — Ad Engine validates tracking token and returns destination URL.
13. `POST /api/v1/ads/click` (Tampered Token) — Security rejects forged signature with 400 Bad Request.
14. `POST /api/v1/analytics/events` — Analytics ingests multi-event funnel batch (`PAGE_VIEW` → `TOOL_START` → `TOOL_COMPLETE`).
15. `GET /admin` — Unauthenticated admin UI access redirects to `/admin/login`.
16. `GET /api/v1/admin/metrics` — Unauthenticated admin API request rejected with 401 Unauthorized.

---

## 6. Pre-Launch Database Backup & Disaster Recovery

### Creating a Production Backup
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
```
- Artifacts are saved to `./backups/ad_utility_db_backup_YYYYMMDD_HHMMSS.sql`.
- Backups are automatically ignored by `.gitignore`.

### Verifying Backup Integrity & Disposable Restore
```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 -BackupFile ./backups/ad_utility_db_backup_YYYYMMDD_HHMMSS.sql
```

---

## 7. Rollback Runbook

If a critical flaw is detected post-deployment:
1. **Frontend Rollback:** Revert container image to previous tag:
   ```bash
   docker compose -f docker-compose.prod.yml stop frontend
   # Update docker-compose.prod.yml image tag to PREVIOUS_VERSION
   docker compose -f docker-compose.prod.yml up -d frontend
   ```
2. **Backend Rollback:**
   ```bash
   docker compose -f docker-compose.prod.yml stop backend
   # Revert backend image tag to PREVIOUS_VERSION
   docker compose -f docker-compose.prod.yml up -d backend
   ```
3. **Database Migration Safety:** Prisma migrations in this repository are strictly **additive** (adding columns, indices, tables). No destructive drops are included in recent migrations, ensuring backward compatibility with previous container tags.
4. **Emergency DB Restore:** If database state is corrupted:
   ```bash
   docker exec -i ad_utility_postgres psql -U postgres -d ad_utility_db < ./backups/ad_utility_db_backup_PRE_LAUNCH.sql
   ```
