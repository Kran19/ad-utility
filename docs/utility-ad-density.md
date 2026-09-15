# Utility Page 4-Ad Minimum Monetization Inventory Specification (Phase 31)

## 1. Overview & Policy Statement

Every individual utility page across the Utility + Ad Platform standardizes around **FOUR CORE AD PLACEMENT OPPORTUNITIES**:

1. **`HEADER_BANNER`** (Top Banner, immediately below Navbar, above Breadcrumbs)
2. **`TOP_CONTENT`** (Top Content Banner, immediately below Utility Title/Description, above Tool Workspace)
3. **`AFTER_TOOL`** (After Tool Banner, immediately below interactive Tool Workspace, above How-to Guide)
4. **`BOTTOM_CONTENT`** (Bottom Content Banner, below Related Utilities, above Footer)

### Supplemental / Optional Inventory
- **`MID_CONTENT`**: Embedded within long supporting documentation/FAQ sections (rendered only when meaningful content exists).
- **`SIDEBAR`**: Desktop right-hand column (`300px` sticky, visible on Desktop `lg:block`, hidden on Tablet & Mobile).
- **`MOBILE_STICKY`**: Fixed bottom sticky banner overlay (`320x50`, visible on Mobile `md:hidden`, hidden on Desktop).
- **`DESKTOP_STICKY`**: Floating bottom-right corner overlay (`300x250`, visible on Desktop `xl:block`, hidden on Tablet & Mobile).

---

## 2. Architecture & Execution Isolation

```
INDIVIDUAL UTILITY PAGE
        │
        ├── 1. HEADER_BANNER (Core Opportunity #1)
        │
        ├── 2. TOP_CONTENT (Core Opportunity #2)
        │
        ├── [INTERACTIVE TOOL WORKSPACE]  <-- 100% Unhindered Execution
        │
        ├── 3. AFTER_TOOL (Core Opportunity #3)
        │
        └── 4. BOTTOM_CONTENT (Core Opportunity #4)
                │
                ▼
           AdPlacementSlot / AdSlot
                │
                ▼
        POST /api/v1/ads/slot
                │
                ▼
        AdSelectorService (Authoritative Backend Algorithm)
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
     Device  Utility  Placement
        │       │        │
        └───────┼────────┘
                ▼
             Creative
                │
          ┌─────┴─────┐
          ▼           ▼
      Impression     Click
```

### Key Operational Rules
1. **Asynchronous & Non-Blocking**: Ad requests never delay or block client uploads, local browser processing, remote API worker jobs, conversions, or downloads.
2. **Fail-Open Isolation**: If an individual ad placement fails (e.g. timeout, Redis issue, or no assigned rule), the remaining three placements and the tool continue operating with zero disruption.
3. **Strict Tool-Level Assignment**: For tool pages, an ad is only served if explicitly assigned to that utility (or its category) in the Admin Panel. Unassigned tools return `hasAd: false` (`TIER_5_NO_AD`).
4. **Premium Ad-Free Protection**: Subscribed users receive `hasAd: false` (`reason: 'PREMIUM_AD_FREE'`) across all four core slots. No ad impressions or tracking events are generated.
5. **No Layout Shift (CLS)**: Pre-reserved CSS min-heights and max-widths prevent layout shifting during asynchronous creative loading.

---

## 3. Four Core Placements Specification

| Core Placement | Exact Location | Supported Devices | Dimensions / Class | Behavior on No-Ad |
| :--- | :--- | :--- | :--- | :--- |
| **`HEADER_BANNER`** | Below Navbar, above Breadcrumbs | Desktop, Tablet, Mobile | `max-w-4xl`, `min-h-[50px]` (mobile) / `min-h-[90px]` (desktop) | Collapses cleanly, zero blank space |
| **`TOP_CONTENT`** | Below Title & Description, above Tool Workspace | Desktop, Tablet, Mobile | `max-w-4xl`, `min-h-[90px]` | Collapses cleanly, zero blank space |
| **`AFTER_TOOL`** | Below Tool Workspace, above How-To Guide | Desktop, Tablet, Mobile | `max-w-4xl`, `min-h-[90px]` | Collapses cleanly; never covers tool results or download button |
| **`BOTTOM_CONTENT`** | Below Related Utilities, above Footer | Desktop, Tablet, Mobile | `max-w-4xl`, `min-h-[90px]` | Collapses cleanly, low disruption |

---

## 4. Admin Ad Manager Core Coverage

The Admin Ad Manager (`/admin/ad-manager`) provides visual tracking of the 4 core monetization slots per utility:
- **Core 4-Ad Monetization Indicator**: Exposes `X/4 Core Covered` status per tool.
- **Device-Specific Allocation**: Allows independent campaigns to be mapped to `DESKTOP`, `TABLET`, and `MOBILE` viewports.
- **Live Selector Simulation**: Executes live simulation tests against all 4 core slots via `POST /api/v1/admin/ads/preview`.
