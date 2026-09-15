# Standardized Ad Placement Inventory Specification (Phase 30)

## 1. Overview & Architectural Principles

The Utility + Ad Platform standardizes the entire frontend inventory around exactly **8 canonical ad placements**. Each placement has a strictly defined physical meaning, responsive lifecycle, and DOM location.

```
PLACEMENT  = WHERE the ad appears
DEVICE     = WHO is viewing (Desktop, Tablet, Mobile)
CREATIVE   = WHAT asset is rendered
UTILITY    = WHICH tool provides context
CATEGORY   = WHICH group provides context
CAMPAIGN   = WHICH business rules govern delivery
```

### Uncompromised Core Principles
1. **Single Authoritative Algorithm**: `AdSelectorService` remains the sole authority for evaluating campaigns, targeting rules, frequency caps, priorities, and fallbacks.
2. **Clean Separation of Concerns**: The frontend `AdPlacementSlot` controls only physical location, layout reservations (min-height/max-width to prevent CLS), and responsive visibility.
3. **Fail-Open & Non-Blocking**: Ad requests never block utility execution, file processing, or rendering. If no ad is assigned or if the ad API fails, the slot collapses cleanly without leaving blank space or error messages.
4. **Strict Tool-Level Assignment**: On tool pages (`utilitySlug`), ads are only rendered if explicitly assigned to that tool or its category in the Admin Panel.

---

## 2. The 8 Canonical Ad Placements

| Placement Code | Supported Devices | Physical Location & Semantics | Responsive Behavior | Recommended Asset Types |
| :--- | :--- | :--- | :--- | :--- |
| **`HEADER_BANNER`** | Desktop, Tablet, Mobile | Immediately below Navbar, above Breadcrumbs | Full width (max 728px), min-h 50px (mobile) / 90px (desktop) | 728x90 Leaderboard, 320x50 Mobile Banner |
| **`TOP_CONTENT`** | Desktop, Tablet, Mobile | Immediately below Utility Title/Description, above Tool Workspace | Full width (max 728px), min-h 90px | 728x90 Leaderboard, 468x60 Banner, 320x50 Banner |
| **`AFTER_TOOL`** | Desktop, Tablet, Mobile | Immediately below Tool Workspace, above How-to Guide | Full width (max 728px), min-h 90px. Never covers tool results/CTA | 728x90 Leaderboard, Rich HTML/Video Creative |
| **`MID_CONTENT`** | Desktop, Tablet, Mobile | Embedded between How-to Guide and FAQ | Rendered only when page has meaningful supporting content | 728x90 Leaderboard, 468x60 Banner |
| **`BOTTOM_CONTENT`** | Desktop, Tablet, Mobile | Below Related Utilities, above Footer | Low-disruption footer-adjacent placement | 728x90 Leaderboard, 320x50 Banner |
| **`SIDEBAR`** | Desktop only | Right-side column alongside main utility content | Visible on Desktop (`lg:block`), hidden on Tablet & Mobile | 300x250 Medium Rectangle, 160x600 Skyscraper |
| **`MOBILE_STICKY`** | Mobile, Tablet | Fixed bottom sticky overlay with safe area insets | Visible on Mobile (`md:hidden`), hidden on Desktop | 320x50 Mobile Sticky Banner |
| **`DESKTOP_STICKY`** | Desktop only | Floating bottom-right corner overlay | Visible on Desktop (`xl:block`), hidden on Tablet & Mobile | 300x250 Floating Corner Card |

---

## 3. Supported Inventory Device Matrix

```
                     DESKTOP    TABLET    MOBILE

HEADER_BANNER           ✓          ✓         ✓
TOP_CONTENT             ✓          ✓         ✓
AFTER_TOOL              ✓          ✓         ✓
MID_CONTENT             ✓          ✓         ✓
BOTTOM_CONTENT          ✓          ✓         ✓
SIDEBAR                 ✓          —         —
MOBILE_STICKY           —          ✓         ✓
DESKTOP_STICKY          ✓          —         —
```

---

## 4. Standard Page Layouts

### 4.1 Utility Tool Page Layout
```
NAVBAR
  ↓
HEADER_BANNER
  ↓
Breadcrumbs
  ↓
┌───────────────────────────────────────────────────────────┬───────────────────┐
│ MAIN CONTENT COLUMN                                       │ DESKTOP SIDEBAR   │
│                                                           │                   │
│ Utility Title & Description Hero                          │ SIDEBAR (300px)   │
│   ↓                                                       │                   │
│ TOP_CONTENT                                               │                   │
│   ↓                                                       │                   │
│ TOOL WORKSPACE (Interactive ToolRunner)                   │                   │
│   ↓                                                       │                   │
│ AFTER_TOOL                                                │                   │
│   ↓                                                       │                   │
│ How-to Guide & Documentation                              │                   │
│   ↓                                                       │                   │
│ MID_CONTENT                                               │                   │
│   ↓                                                       │                   │
│ Frequently Asked Questions (FAQ)                          │                   │
│   ↓                                                       │                   │
│ Personalized Related Utilities                            │                   │
│   ↓                                                       │                   │
│ BOTTOM_CONTENT                                            │                   │
└───────────────────────────────────────────────────────────┴───────────────────┘
  ↓
MOBILE_STICKY (Mobile only, fixed bottom overlay)
DESKTOP_STICKY (Desktop only, floating corner overlay)
  ↓
FOOTER
```

### 4.2 Category Page Layout
```
NAVBAR
  ↓
HEADER_BANNER
  ↓
Breadcrumbs
  ↓
Category Hero & Tool Counter
  ↓
TOP_CONTENT
  ↓
Category Utilities Grid
  ↓
MID_CONTENT (if utility count >= 6)
  ↓
BOTTOM_CONTENT
  ↓
FOOTER
```

### 4.3 Homepage Layout
```
NAVBAR
  ↓
Hero Search & Quick Category Selector
  ↓
Browse by Category Badges
  ↓
MID_CONTENT
  ↓
All Online Tools Grouped Directory
  ↓
BOTTOM_CONTENT
  ↓
FOOTER
```

---

## 5. Security & Tracking Integrity

1. **Authoritative Click Tracking**: Click redirects resolve authoritatively on the backend using signed HMAC tokens. Arbitrary redirect parameters are blocked.
2. **True Impression Threshold**: Impressions are triggered strictly when an ad achieves at least 50% viewport visibility via `IntersectionObserver`.
3. **Premium Ad-Free Experience**: Verified subscribers bypass all ad rendering cleanly (`hasAd: false`, `reason: 'PREMIUM_AD_FREE'`) with zero telemetry noise.
