# ADR-026: Admin Control Panel Utility & Ad Operations Architecture

## Context

The platform has a production-ready Ad Engine supporting multi-tiered targeting precedence (`TIER_1_EXACT_UTILITY` through `TIER_5_NO_AD`), device targeting (`DESKTOP`, `TABLET`, `MOBILE`), schedules, frequency capping, and external ad network delivery. However, managing targeting rules in the Admin Panel previously required manual knowledge of raw targeting rules without a holistic utility-centric matrix view. Operators needed an intuitive way to view, assign, and preview ads per utility and per device, while preserving the frozen core Ad Engine architecture.

## Decision

1. **Overlay UX Over Frozen Core Engine**:
   - Implement an operational management layer without modifying `AdSelectorService` algorithms or core eligibility logic.
   - Ad previews execute the real `AdSelectorService.selectAd` method to ensure 100% fidelity between admin simulations and production ad delivery.

2. **Accurate Device-Aware Aggregation**:
   - Compute applicable rules per utility without double-counting multi-device or multi-utility rules.
   - When a rule targets `[DESKTOP, MOBILE]`, it increments the desktop count by 1 and the mobile count by 1 for that utility, while contributing exactly 1 to the distinct rule total.

3. **Dynamic Placement Discovery**:
   - Inventory placement slots are dynamically loaded from `GET /api/v1/admin/ads/placements` (retrieved from the database) rather than hardcoding slot names in the frontend. This guarantees the UI only exposes placements that have valid rendering slots.

4. **Consistent Status Terminology**:
   - Align status terminology across the UI to `ACTIVE` and `DISABLED` matching `AdTargetingRule.isActive` and `Utility.status`. `DRAFT` is retained as a distinct publication/staging status.

5. **Server-Side Assignment Deduplication**:
   - Enforce server-side validation on `POST /api/v1/admin/ads/targeting` to prevent accidental duplicate targeting rules for identical campaign, placement, creative, device, and utility combinations.

6. **Explainable Selection Verification**:
   - Structure ad simulation responses to include an explainable verdict tier (`TIER_1_EXACT_UTILITY` through `TIER_5_NO_AD`) with plain-English descriptions explaining why an ad won or fell back.

## Consequences

- **Positive**:
  - Operators can view and manage ads on a utility-by-utility basis across desktop, tablet, and mobile.
  - Zero divergence between admin preview and production ad delivery.
  - Immediate operational visibility into unmonetized tools or missing device slots.
  - Core Ad Engine remains frozen, clean, and decoupled from admin visualization.
- **Negative / Neutral**:
  - Requires loading active targeting rules when displaying utility registry (cached in memory and bounded by active campaign count).
