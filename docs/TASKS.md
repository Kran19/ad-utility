## Phase 31 Tasks — Utility Page 4-Ad Minimum Monetization Inventory
- [x] Audit individual utility page templates, `AdPlacementSlot`, `AdSlot`, and `AdSelectorService`.
- [x] Enforce 4 core ad placement opportunities on every utility page (`HEADER_BANNER`, `TOP_CONTENT`, `AFTER_TOOL`, `BOTTOM_CONTENT`).
- [x] Maintain supplemental optional placements (`MID_CONTENT`, `SIDEBAR`, `MOBILE_STICKY`, `DESKTOP_STICKY`).
- [x] Ensure asynchronous, non-blocking ad loading that never hinders tool processing, uploads, or downloads.
- [x] Maintain fail-open isolation across all slots (failure of one slot does not impact other slots or tool execution).
- [x] Maintain strict premium subscriber ad-free entitlement (`hasAd: false`, `reason: 'PREMIUM_AD_FREE'`).
- [x] Add `Core 4-Ad Monetization Inventory` coverage tracking card (`X/4 Core Covered`) in Admin Ad Manager drawer.
- [x] Write automated test suite `apps/backend/test/utility-ad-density.spec.ts`.
- [x] Generate ADR-031, verification report, and utility ad density specification documentation.
