# Architecture Decision Record (ADR-031): Utility Page 4-Ad Minimum Monetization Inventory

## Context & Problem Statement
To maximize sustainable monetization across all 38+ production utilities while preserving user experience and high tool engagement, we need a standard minimum advertising inventory per utility page. Previous iterations placed ads irregularly across tools.

## Decision Drivers
1. Standardize exactly **4 Core Placement Opportunities** on every individual tool page (`HEADER_BANNER`, `TOP_CONTENT`, `AFTER_TOOL`, `BOTTOM_CONTENT`).
2. Maintain `AdSelectorService` as the single authoritative ad-selection algorithm without duplicate engines or placement bypasses.
3. Guarantee asynchronous, non-blocking ad loading that never blocks tool execution, uploads, processing, or file downloads.
4. Provide independent error isolation across all slots (failure of one slot does not affect other slots or tool execution).
5. Maintain strict ad-free entitlement enforcement for premium subscribers.
6. Provide clear visual core coverage indicators in the Admin Ad Manager.

## Considered Options
1. **Dynamic Arbitrary Ad Injections**: Injecting variable numbers of ads directly inside the utility workspace.
2. **Fixed 4 Core Placements Wrapper Pattern**: Surrounding the utility workspace with 4 standardized core ad opportunities (`HEADER_BANNER`, `TOP_CONTENT`, `AFTER_TOOL`, `BOTTOM_CONTENT`) while keeping the tool workspace 100% untouched.

## Decision Outcome
Adopted **Option 2: Fixed 4 Core Placements Wrapper Pattern**.

### Four Core Placements
- `HEADER_BANNER`: Immediately below Navbar, above Breadcrumbs.
- `TOP_CONTENT`: Immediately below Title/Description, above Tool Workspace.
- `AFTER_TOOL`: Immediately below Tool Workspace, above How-To Guide.
- `BOTTOM_CONTENT`: Below Related Utilities, above Footer.

### Supplemental Placements
- `MID_CONTENT`: Embedded between How-to Guide and FAQ (rendered when meaningful content exists).
- `SIDEBAR`: Desktop right column (`300px`, `hidden lg:block`).
- `MOBILE_STICKY`: Mobile bottom sticky overlay (`block md:hidden`).
- `DESKTOP_STICKY`: Desktop corner floating sticky (`hidden xl:block`).

## Consequences
### Positive
- Predictable, maximized advertising inventory across all 38+ active utilities.
- Zero layout interference with interactive tool runners, file upload dropzones, processing progress bars, or download triggers.
- Full compatibility with existing device targeting, category campaigns, frequency capping, and signed HMAC click tracking.
- Clear Admin visual indicators for `4/4 Core Covered`.

### Negative / Mitigation
- Potential visual density impact on mobile (mitigated by clean spacing and graceful collapse when slots are unassigned).
