# Ad Platform Specification

## 1. Overview & Non-Blocking Execution Guarantee
The Ad Engine is a centralized, first-class module responsible for targeted creative selection, frequency control, priority weighting, and fallback resolution across all public utility pages.

### Non-Blocking Rule
**Advertising is a secondary system.** If the Ad Delivery API fails, times out, or returns a 5xx error, or if an ad creative fails to render, the utility interface and page MUST continue to function flawlessly. Utility execution must NEVER be blocked or degraded by Ad Engine failures.

Public frontend pages NEVER evaluate business logic or select campaigns directly; they request creatives via the standardized endpoint:
`GET /api/v1/ad-engine/deliver?placement={PLACEMENT}&utility={SLUG}&device={DEVICE}`

---

## 2. 12-Step Deterministic Selection Algorithm

The backend Ad Engine resolves ad requests through the following exact 12-step evaluation order:

```
[Request Context: placement, utility, category, device, country, session]
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ 1. Campaign Status Check (Must be ACTIVE)             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Schedule Evaluation (Start/End Date & Time Window)  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Placement Matching (Matches requested Placement ID) │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. Device Targeting (MOBILE, TABLET, DESKTOP)          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. Utility Targeting (Matches requested utility slug)  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 6. Category Targeting (Matches utility category)      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 7. Geographic Targeting (If country targeting enabled) │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 8. Frequency Capping Check (Session & Daily Limits)    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 9. Priority Evaluation (Score grouping, e.g. 100, 80) │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 10. Weighting & Rotation (Proportional random selection│
│     within highest priority candidate pool)            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 11. Creative Format Availability Check                 │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 12. Fallback Resolution Hierarchy                     │
│     Tier 1: Exact Utility + Device + Placement         │
│     Tier 2: Category + Device + Placement               │
│     Tier 3: All Utilities + Device + Placement          │
│     Tier 4: Exact Utility + All Devices + Placement     │
│     Tier 5: Global Fallback Creative                    │
│     Tier 6: Null Creative (No Ad)                       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Placements
- `HEADER_BANNER`: Top header banner (728x90 desktop, 320x50 mobile).
- `TOP_CONTENT`: Main content area directly above tool interface.
- `AFTER_TOOL`: Placed directly below the active tool interface.
- `MID_CONTENT`: Embedded in description/how-to guide.
- `BOTTOM_CONTENT`: Directly above FAQ section.
- `SIDEBAR`: Vertical banner on wide viewports (300x250, 160x600).
- `MOBILE_STICKY`: Sticky footer container on mobile screens.
- `DESKTOP_STICKY`: Floating corner overlay on desktop screens.

---

## 4. Creative Types Supported
- `IMAGE`: Standard web image (`.png`, `.jpg`, `.webp`, `.gif`) with destination URL.
- `VIDEO`: HTML5 MP4 / WebM ad player with auto-mute and impression controls.
- `HTML`: Rich interactive custom HTML/CSS snippet (sanitized with DOMPurify).
- `IFRAME`: Secure sandboxed iframe creative link.
