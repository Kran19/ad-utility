# ADR-004: Utility Engine & Hybrid Registry Architecture

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-02
- **Deciders**: Lead Architect

---

## Context & Problem Statement
The platform will host dozens to hundreds of online utilities across different modalities (browser-based, server-side compute, and AI assistance).
Key requirements:
1. Prevent database-driven remote code execution (RCE) vulnerabilities.
2. Enable dynamic URL routing `/[slug]` without hardcoding custom pages per tool.
3. Establish clean execution boundaries between `LOCAL`, `SERVER`, and `AI` tools.
4. Support standard ad placement integration without coupling utility logic to ad delivery.

---

## Decisions

### 1. Hybrid Registry Pattern
- Database (`Utility` table) stores metadata, lifecycle state (`ACTIVE`, `DRAFT`, `DISABLED`), SEO tags, and FAQ content.
- Code (`UtilityRegistry` class) stores executable adapters implementing `UtilityAdapter<TInput, TOutput>`.
- A tool is executable only when a matching active database record AND a registered compiled adapter exist.

### 2. Universal Dynamic Catch-All Route
- Next.js dynamic route `app/[slug]/page.tsx` serves all utility URLs.
- Server-side metadata fetching with `generateMetadata` dynamically powers SEO title, description, and canonical tags.
- Non-active or unknown utilities immediately trigger Next.js `notFound()` to prevent indexing drafts or disabled tools.

### 3. Standardized Ad Slot Placeholders
- Defined typed placeholder component `<AdSlotPlaceholder placement={code} />` at all 8 master placement positions (`HEADER_BANNER`, `TOP_CONTENT`, `AFTER_TOOL`, `MID_CONTENT`, `BOTTOM_CONTENT`, `SIDEBAR`, `MOBILE_STICKY`, `DESKTOP_STICKY`).
- In Phase 5, `<AdSlotPlaceholder />` will be replaced by the real `<AdSlot />` without modifying utility page structure.

---

## Consequences
- New utilities in Phase 9 only require creating a single `UtilityAdapter` class and registering it in the registry + adding its metadata seed row.
- 49/49 backend automated tests and full monorepo build pass.
