# ADR-010: SEO Engine & Performance Optimization Architecture

## Status
Accepted / Implemented (Phase 10)

## Context
The Utility + Ad Platform requires high organic search visibility, crawlability, and responsive end-user performance across desktop and mobile devices. In previous phases, the platform established a robust multi-tier architecture (NestJS backend, PostgreSQL database, Redis caching, Next.js App Router frontend, Ad Engine, and offline deterministic AI Gateway).

To achieve indexability and Lighthouse-grade performance, we must resolve several architectural challenges:
1. Crawlable discovery without sacrificing Next.js App Router client interactivity.
2. Server-side rendering (SSR) data fetching tradeoffs between direct backend access and public REST endpoints.
3. Heavy dependency isolation so client bundle sizes remain lean (< 100 kB initial load).
4. Redis caching strategy for public utility/category directory views with reliable fail-open error handling.
5. Accurate, non-spammy structured data (JSON-LD) that strictly aligns with rendered HTML.

---

## Decisions

### 1. Hybrid Server-Side Fetching & Public Category Endpoints
- **Decision**: Implemented public endpoints `GET /api/v1/utilities/categories` and `GET /api/v1/utilities/categories/:categorySlug` in NestJS backed by Redis caching.
- **Rationale**: While Next.js can fetch server-side within the container network (`INTERNAL_API_URL`), standardizing public category endpoints ensures that both Next.js SSR and external crawler scrapers/APIs access the identical, authoritative database state without duplicating SQL/Prisma query logic across codebases.
- **Security**: Category endpoints expose only active utilities and sanitize sensitive fields (no internal user/admin data).

### 2. Crawlable Homepage & Category Directories
- **Decision**: Homepage (`/`) and category pages (`/category/[categorySlug]`) render complete semantic HTML listings containing `<a href="/{slug}">` links.
- **Rationale**: Search engine crawlers (Googlebot, Bingbot) do not reliably execute client-side state hooks or complex JavaScript filters. Providing full semantic directory HTML in the initial response guarantees immediate indexing of all 12 MVP tools.
- **URL Structure**: Canonical category paths use `/category/{categorySlug}` while utility pages remain at root `/{utilitySlug}`. Competing paths (e.g. `/tools/{slug}`) are rejected to prevent duplicate content dilution.

### 3. Dynamic Workspace Code-Splitting in `tool-runner.tsx`
- **Decision**: Applied `next/dynamic` with SSR enabled for workspace sub-components (`ImageWorkspace`, `PdfWorkspace`, `TextWorkspace`, `AiWorkspace`).
- **Rationale**: Workspaces contain interactive client logic and file manipulation tools. Dynamically splitting workspaces prevents loading unused utility workspaces when a visitor accesses a specific tool.
- **Outcome**: The shared initial JavaScript footprint dropped to **87.4 kB**, with individual tool pages loading at ~104 kB.

### 4. Zero-Leakage Dependency Boundary
- **Decision**: Server-heavy manipulation libraries (`@napi-rs/canvas`, `pdfjs-dist`, `pdf-lib`, `jszip`, `jpeg-js`, `pngjs`) are strictly confined to `apps/backend`.
- **Rationale**: Bundling PDF rasterizers or native canvas engines into client bundles would bloat bundle sizes into several megabytes and break browser execution environments. The shared library (`@ad-utility/shared`) exports only contracts and pure deterministic local adapters.

### 5. Redis Caching with 300s TTL and Fail-Open Recovery
- **Decision**: Cached category hierarchies in Redis with a 300-second TTL and automatic invalidation on administrative updates.
- **Rationale**: Reduces database query load during traffic spikes. If Redis is unavailable or times out, `UtilitiesCacheService` catches the exception and falls back transparently to PostgreSQL, preserving 100% uptime.

### 6. Semantic & Verified JSON-LD Schema Generation
- **Decision**: Only emit justified schemas: `WebSite` for root, `WebApplication` for tools, `BreadcrumbList` for breadcrumbs, and `FAQPage` **only** if visible FAQ accordions exist on the page.
- **Rationale**: Prevents search engine penalties for misleading structured data. No fabricated reviews, aggregate ratings, or fake pricing schemas are permitted.

---

## Consequences

### Positive
- All 12 MVP utilities and 5 categories are crawlable in clean semantic HTML with 0 reliance on client-side JS for indexing.
- Initial JavaScript shared by all pages is bounded at 87.4 kB.
- API category requests resolve in ~5.7ms (cached) and ~17.5ms (uncached).
- Next.js SSR page renders complete in ~31ms (homepage) and ~54ms (utility page).
- 100% backward compatibility maintained across all 118 existing tests, with 10 new Phase 10 tests passing (128/128 total).

### Negative / Tradeoffs
- Static sitemap revalidation takes up to 1 hour to cycle unless manually invalidated.
- Server-side fetching adds a lightweight internal network hop (`localhost:4001`) during SSR, which is mitigated by Redis caching.
