# IMPLEMENTATION PLAN — UTILITY + AD PLATFORM

## Master Architectural Phases (Strict Sequential Order)

### Phase 0: Repository Audit & Architectural State (COMPLETED)
- [x] Audit workspace and repository environment.
- [x] Create project state tracking system (`PROJECT_STATUS.md`, `IMPLEMENTATION_PLAN.md`, `TASKS.md`, `CHANGELOG.md`).
- [x] Create core architecture documentation (`docs/architecture.md`, `database.md`, `ads.md`, `utilities.md`, `ai.md`, `analytics.md`, `seo.md`, `security.md`, `environment.md`).
- [x] Create ADR-001 (`docs/decisions/ADR-001-hybrid-utility-registry-and-phase-order.md`).
- [x] Create `.env.example`.

### Phase 1: Foundation, Monorepo & Docker Environment
- [ ] Initialize monorepo structure (`apps/backend`, `apps/frontend`, `packages/shared`).
- [ ] Configure `docker-compose.yml` (PostgreSQL 16, Redis 7, Backend NestJS, Frontend Next.js).
- [ ] Configure development and production Dockerfiles.
- [ ] Verification Gate: All containers build, run health checks, and inter-service networking operates cleanly.

### Phase 2: PostgreSQL, Prisma ORM & Database Architecture
- [ ] Initialize Prisma ORM in `apps/backend/prisma/schema.prisma`.
- [ ] Relational Schema definitions: Users, RBAC, Utilities (Metadata layer), Campaigns, Creatives, Placements, Targeting, Schedules, Impressions, Clicks, AI Logs, Analytics Events, Settings, Audit Logs.
- [ ] Database migration & seeding script execution.
- [ ] Verification Gate: Database migrations pass, seeds execute cleanly inside Docker.

### Phase 3: Authentication & RBAC System
- [ ] NestJS Auth Module (JWT access/refresh tokens, bcrypt password hashing).
- [ ] RBAC Decorators & Guards (`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST`).
- [ ] Verification Gate: Auth unit/integration tests pass; server-side RBAC enforcement confirmed.

### Phase 4: Utility Engine, Hybrid Registry & Dynamic Routing
- [ ] Define `UtilityAdapter` contract and static `UtilityRegistry` in code.
- [ ] Backend utility service database metadata synchronization.
- [ ] Next.js catch-all dynamic route `app/[slug]/page.tsx` with standard responsive page layout.
- [ ] Verification Gate: Slugs render shell UI, metadata, and tool workspace placeholder.

### Phase 5: Ad Engine, Delivery API & `<AdSlot />` Component
- [ ] NestJS Ad Delivery Service with 12-step deterministic selection & multi-tier fallback algorithm.
- [ ] Dynamic Ad delivery REST endpoint (`GET /api/v1/ad-engine/deliver`).
- [ ] Next.js `<AdSlot />` client component rendering Image, Video, Custom HTML, and iFrame creatives.
- [ ] Verification Gate: 12-step algorithm unit tests pass; ad failure does NOT block page or utility UI.

### Phase 6: Centralized AI Gateway
- [ ] NestJS AI Gateway module (`apps/backend/src/ai-gateway`).
- [ ] OpenAI SDK integration, token budgeting, sliding window rate limits, usage logging, error retries.
- [ ] Verification Gate: AI Gateway unit & integration tests pass; token usage logged to `AiRequest`.

### Phase 7: First-Party Analytics Engine
- [ ] NestJS Telemetry module for non-blocking event recording (`page_view`, `tool_start`, `tool_complete`, `ad_impression`, `ad_click`).
- [ ] UTM attribution tracking (`utm_source`, `utm_medium`, `utm_campaign`).
- [ ] Verification Gate: Telemetry failures do NOT interrupt utility execution or frontend rendering.

### Phase 8: Admin Control Panel
- [ ] Nested Next.js Admin UI (`/admin/*`) protected by RBAC.
- [ ] Management interfaces for Campaigns, Creatives, Placements, Targeting rules, Utility metadata toggles, and Analytics.
- [ ] Verification Gate: Campaign & Creative creation and targeting configuration E2E flow verified.

### Phase 9: Implementation of 10 Initial MVP Utilities
- [ ] Implement 6 client-side utilities (`jpg-to-png`, `png-to-jpg`, `image-compressor`, `image-resizer`, `json-formatter`, `word-counter`).
- [ ] Implement 2 server-side PDF utilities (`pdf-compressor`, `pdf-merger`).
- [ ] Implement 2 AI-powered utilities (`ai-humanizer`, `ai-summarizer`).
- [ ] Integrate all 10 tools with `<AdSlot />`, Analytics hooks, and standard Utility Layout.
- [ ] Verification Gate: All 10 tools functional with working ads, analytics, loading/error states.

### Phase 10: SEO Engine & Performance Optimization
- [ ] Dynamic Open Graph, Twitter Cards, Canonical URLs, JSON-LD schemas (`WebApplication`, `FAQPage`, `BreadcrumbList`).
- [ ] Dynamic `sitemap.xml` and `robots.txt`.
- [ ] Verification Gate: Lighthouse SEO score > 95; schema validation succeeds.

### Phase 11: Automated Testing & Security Hardening
- [ ] Complete unit, integration, and E2E test suites.
- [ ] Security audit: Helmet security headers, CORS origin restriction, rate limiting, input sanitization against XSS/SSRF/SQLi.
- [ ] Verification Gate: 100% build pass; security audit cleanly passed.

### Phase 12: Production Readiness & Deployment
- [ ] Production Docker configuration (`docker-compose.prod.yml`).
- [ ] Production build verification, health checks, backup strategies.
- [ ] Verification Gate: Full production environment deployment verification.
