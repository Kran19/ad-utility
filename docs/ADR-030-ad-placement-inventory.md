# Architecture Decision Record (ADR-030): Standardized Ad Placement Inventory

## Context & Problem Statement
Prior to Phase 30, ad slots were placed across various pages with slightly varying naming conventions and unstructured responsive layout constraints. To maximize monetization without compromising user experience or Core Web Vitals (CLS), we needed a single canonical 8-placement inventory standard across all production utilities, category pages, and homepage views.

## Decision Drivers
1. Strict physical semantic definition for every placement slot (WHERE).
2. Elimination of ad placement fragmentation across tools.
3. Preservation of the existing backend `AdSelectorService` as the single authoritative decision algorithm (WHICH).
4. Deterministic responsive behavior across Desktop, Tablet, and Mobile.
5. Zero Cumulative Layout Shift (CLS) through stable CSS min-height/max-width reservations and clean conditional collapsing.

## Considered Options
1. **Ad-hoc Inline Placements**: Pages place individual ad wrappers with custom CSS classes.
2. **Standardized `AdPlacementSlot` Wrapper around `AdSlot`**: A single centralized wrapper component that enforces the exact responsive visibility, layout reservations, and placement codes for all 8 canonical placements.

## Decision Outcome
Adopted **Option 2: Standardized `AdPlacementSlot` Component**.

### Canonical 8 Placements
1. `HEADER_BANNER`: Immediately below Navbar, above Breadcrumbs.
2. `TOP_CONTENT`: Immediately below Title/Description, above Tool Workspace.
3. `AFTER_TOOL`: Immediately below Tool Workspace, above How-to Guide.
4. `MID_CONTENT`: Embedded between How-to Guide and FAQ.
5. `BOTTOM_CONTENT`: Below Related Utilities, above Footer.
6. `SIDEBAR`: Desktop right column alongside main content (`hidden lg:block`).
7. `MOBILE_STICKY`: Mobile bottom fixed sticky overlay (`block md:hidden`).
8. `DESKTOP_STICKY`: Desktop bottom-right corner floating sticky (`hidden xl:block`).

### Strict Responsibility Hierarchy
- `AdPlacementSlot` (Frontend Wrapper): Controls physical location, responsive media queries, and minimum layout dimensions.
- `AdSlot` (Frontend Core): Handles client device detection, IntersectionObserver impression logging, and click tracking.
- `AdSelectorService` (Backend Engine): Executes campaign evaluation, schedule verification, priority ranking, frequency capping, and deterministic rotation.

## Consequences
### Positive
- Unified, consistent layout structure across all 38+ production utilities.
- Guaranteed CLS stability with graceful collapse on unassigned or no-ad states.
- Clean integration with Admin Ad Manager and live preview simulators.
- Seamless compatibility with Phase 26 subscription ad-free entitlements.

### Negative / Mitigation
- Requires consistent structure across all future utility pages (mitigated by standardized template in `apps/frontend/src/app/[slug]/page.tsx`).
