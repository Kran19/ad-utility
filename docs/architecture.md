# System Architecture Specification

## 1. High-Level Platform Overview
The Utility + Ad Platform is built as a single-domain, high-concurrency web application hosting hundreds of online utilities (e.g., Image processing, PDF tools, AI converters, Text tools) alongside a centralized, real-time Ad Delivery Engine and AI Gateway.

```
                      +-----------------------------+
                      |      Browser / Client       |
                      |   (Next.js App Router UI)   |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
    +--------------------+                       +-------------------+
    | Client-Side Local  |                       |  NestJS REST API  |
    | Utility Processing |                       |   (Backend Core)  |
    | (Canvas/WASM/JS)   |                       +---------+---------+
    +--------------------+                                 |
                                     +---------------------+---------------------+
                                     |                     |                     |
                                     v                     v                     v
                            +-----------------+   +-----------------+   +-----------------+
                            | PostgreSQL 16   |   |     Redis 7     |   |   OpenAI API    |
                            | (Prisma DB)     |   | (Cache/Queue)   |   | (via AI Gateway)|
                            +-----------------+   +-----------------+   +-----------------+
```

---

## 2. Core Architectural Components

### A. Next.js Frontend (`apps/frontend`)
- **App Router & Dynamic Slug Routing**: Single catch-all handler `app/[slug]/page.tsx` that resolves requested slug against the `UtilityRegistry`.
- **Server Components & Client Hydration**: Static shell (header, footer, metadata, FAQs, related tools) rendered server-side; dynamic tool workspace hydrated on client.
- **`<AdSlot />` Component**: Standardized client component that queries the NestJS Ad Engine asynchronously with non-blocking error handling.

### B. NestJS Backend (`apps/backend`)
- **Modular Monolith**:
  - `auth`: JWT authentication & RBAC guards.
  - `utilities`: Server-side file processing (PDF merging/compression).
  - `ad-engine`: Targeting evaluation, priority selection, fallback hierarchy, impression/click recording.
  - `ai-gateway`: OpenAI API integration, token tracking, rate limiting.
  - `analytics`: Lightweight event tracking pipeline.
  - `admin`: Management endpoints for campaigns, creatives, placements, utility toggles.

### C. Data & Storage Layer
- **PostgreSQL 16**: Relational storage for campaigns, creatives, placements, targeting rules, user accounts, audit logs, and analytics.
- **Prisma ORM**: Type-safe query building, migration management, and relational mapping.
- **Redis 7**: High-speed cache for ad targeting evaluation results, rate limiters, and background job queue handling.

---

## 3. Communication Patterns
- **Client to Backend**: RESTful JSON APIs (`/api/v1/*`) with standard response envelopes (`{ success: true, data: ..., error: null }`).
- **Backend to AI**: Private server-side HTTPS calls to OpenAI API. Secrets are NEVER exposed to the browser.
- **Backend to Database**: Type-safe queries via Prisma ORM pool.
