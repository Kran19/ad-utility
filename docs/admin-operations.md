# Admin Control Panel — Utility & Ad Operations Manual

## 1. Overview & Operational Goals

The **Admin Control Panel Utility & Ad Operations Enhancement** provides an intuitive, high-visibility management layer for platform operators and administrators.

The operational objective is **operational simplicity**:
An administrator can immediately answer questions such as:
- *"What ads will appear on JPG to PNG on mobile?"*
- *"What ads will appear on PDF Merge on desktop?"*
- *"Why did a particular ad win or fallback for a specific device and placement?"*

This operational layer is built strictly **over the existing frozen Ad Engine** without creating a secondary selection engine or altering core eligibility logic.

---

## 2. Utility Registry & Metadata Operations (`/admin/utilities`)

The `/admin/utilities` interface provides comprehensive oversight of all registered platform utilities.

### Key Capabilities:
1. **Tool Name & Slug Display**:
   - Lists tool name, path (`/{slug}`), and registered category.
2. **Ads Assigned Column**:
   - Displays device breakdown of active assignments: `Desktop N · Mobile M · Tablet T`.
   - Displays `No ads configured` in muted italics if zero rules apply.
   - Directly links to `/admin/ad-manager?utility={slug}` for instant management.
3. **Single Binary Status Toggle (`ACTIVE <-> DISABLED`)**:
   - Displays current publication status with a single-click toggle.
   - Clicking `ACTIVE` toggles the utility to `DISABLED`.
   - Clicking `DISABLED` toggles the utility to `ACTIVE`.
   - `DRAFT` tools remain distinct workflow states with publication options.
4. **Edit Utility Drawer / Modal**:
   - Clicking on a utility name opens the edit drawer.
   - **Read-Only Fields**: `Slug` and `Execution Mode` (`LOCAL`, `SERVER`, `AI`) to protect routing and runtime invariants.
   - **Editable Fields**:
     - Tool Name
     - Description
     - Category
     - Status (`ACTIVE` / `DISABLED` / `DRAFT`)
     - Featured on homepage toggle
     - SEO Title
     - SEO Description
     - Canonical URL

---

## 3. Ad Operations & Targeting Matrix (`/admin/ad-manager`)

The `/admin/ad-manager` interface provides a centralized operations console for all ad allocations across the catalog.

### 3.1 Overview Matrix
- **Matrix Columns**:
  - **Utility**: Name and URL slug.
  - **Category**: Associated category taxonomy.
  - **Desktop**: Count of applicable targeting rules for desktop devices.
  - **Tablet**: Count of applicable targeting rules for tablet devices.
  - **Mobile**: Count of applicable targeting rules for mobile devices.
  - **Total**: Count of distinct applicable rules without double-counting.
  - **Actions**: "Manage" (opens device configuration) and "👁️ Preview".

### 3.2 Dynamic Filtering
- **Device Filter**: `ALL`, `DESKTOP`, `TABLET`, `MOBILE`.
- **Placement Filter**: Dynamically loaded from `/admin/ads/placements` (no hard-coded slot codes).
- **Status Filter**: `ALL`, `ACTIVE`, `DISABLED`.
- **Category Filter**: Dynamically loaded from `/admin/utilities/categories`.
- **Campaign Filter**: Filter by active or paused campaigns.
- **Search**: Real-time filtering across tool names and slugs.

### 3.3 Manage Ads Panel (Device-by-Device Breakdown)
Selecting a utility opens the **Manage Ads Panel**:
- **Device Tabs**:
  - `[ALL]`
  - `[DESKTOP]` (shows count badge)
  - `[TABLET]` (shows count badge)
  - `[MOBILE]` (shows count badge)
- **Assigned Targeting Rules Table**:
  - Campaign name and campaign status badge (`ACTIVE` / `PAUSED` / `DRAFT`)
  - Inventory placement slot code & name
  - Creative name, format (`IMAGE`, `VIDEO`, `HTML`, `IFRAME`), and dimensions
  - Device eligibility tags (`DESKTOP`, `TABLET`, `MOBILE`)
  - Weight (1–1000) and Priority Override
  - Status toggle (`ACTIVE` / `DISABLED`)
  - Delete action
- **Assign Ad Modal**:
  - Campaign selector
  - Placement selector (dynamically populated from existing inventory)
  - Creative asset selector
  - Device targeting checkboxes (`[✓ Desktop]`, `[✓ Tablet]`, `[✓ Mobile]`)
  - Priority override & weight controls
  - Immediate `ACTIVE` toggle
  - Server-side duplicate validation prevents duplicate rules for identical campaign, placement, creative, device, and utility tuples.

---

## 4. Live Ad Selector Simulation Tool

The live preview feature executes the **production `AdSelectorService`** in a simulated environment, verifying which creative is chosen and explaining the exact fallback decision.

### Simulation Inputs:
- **Target Utility**: Dropdown of all registered utilities.
- **Device Type**: `DESKTOP`, `TABLET`, or `MOBILE`.
- **Placement Slot**: Dynamically populated placement codes (e.g. `TOP_CONTENT`, `HEADER_BANNER`, `SIDEBAR`).
- **Country**: Optional ISO country code (defaults to `US`).

### Selection Output & Explainability:
1. **Fallback Tier Explanation Banner**:
   - **`TIER_1_EXACT_UTILITY` (Exact Utility Match)**: Direct match targeted specifically to the utility.
   - **`TIER_2_CATEGORY` (Category Match)**: Category fallback matched to the utility's parent category.
   - **`TIER_3_GLOBAL_PLACEMENT` (Global Placement Fallback)**: Global campaign rule for this placement slot.
   - **`TIER_4_GLOBAL_FALLBACK` (House Ad Fallback)**: House ad creative served when no commercial campaigns match.
   - **`TIER_5_NO_AD` (No Ad Available)**: Explains that no active creative or campaign is configured for this slot/device.
2. **Visual Ad Creative Box**:
   - Displays rendered headline, body copy, asset image, call-to-action button, and format.
   - Shows simulated campaign name, dimensions, and signed tracking token generation status.
