# Ad Engine, Targeting, Rotation & Delivery Architecture

## 1. Executive Overview
The Ad Engine is a centralized, high-performance, fault-tolerant advertising subsystem responsible for delivering targeted advertising across all platform utility pages.
It evaluates campaigns, schedules, placements, utilities, categories, devices, geography, and frequency caps to select ad creatives deterministically with weighted rotation and multi-tier fallbacks.

### Core Architecture Principles
1. **Database is Configuration**: PostgreSQL (`ad_campaigns`, `ad_creatives`, `ad_targeting_rules`, `ad_placements`, `ad_schedules`) holds persistent configuration and relational targeting rules. Zero executable strings, `eval()`, or dynamic code are stored in the database.
2. **Frontend Isolation**: The Next.js frontend has zero direct database/Prisma access. It communicates exclusively via the REST API (`/api/v1/ads/slot`, `/api/v1/ads/impression`, `/api/v1/ads/click`).
3. **Fault-Tolerance / Non-Blocking**: Ad failures (database latency, Redis disconnects, tracking errors, malformed creatives) NEVER break utility page rendering or utility tool execution. If no ad matches or if an error occurs, the engine returns a clean `{ hasAd: false }` response.
4. **No-Ad is Valid**: When no matching campaign/creative is eligible, returning `hasAd: false` is standard expected behavior, not an error.

---

## 2. 12-Step Deterministic Ad Selection Sequence

When a request arrives at `POST /api/v1/ads/slot`, the engine evaluates candidate targeting rules in the following exact sequence:

```
 1. Campaign Active Check    ──> Campaign status === 'ACTIVE'
 2. Schedule Eligibility     ──> startDate <= now <= endDate, and AdSchedule matches current day/hour (UTC)
 3. Placement Match          ──> Rule placementId matches requested placement
 4. Utility Match            ──> utilitySlugs contains requested slug (or empty = all)
 5. Category Match           ──> categorySlugs contains utility's category (or empty = all)
 6. Geographic Match         ──> countries contains request country (or empty = all)
 7. Device Match             ──> deviceTypes contains request device (MOBILE, TABLET, DESKTOP)
 8. Frequency Cap Check      ──> Redis atomic counter check (daily/total impression caps per session)
 9. Specificity & Priority   ──> Exact Context > Category Context > Global Placement; highest priority first
10. Weighted Rotation        ──> Deterministic cumulative weight selection among equal-priority candidates
11. Creative Selection       ──> Retrieve matching AdCreative (IMAGE, VIDEO, HTML, IFRAME) + generate signed tracking token
12. Multi-Tier Fallback      ──> If no candidate: Tier 1 (Exact) -> Tier 2 (Category) -> Tier 3 (Global Fallback) -> No-Ad
```

---

## 3. Device Targeting Model
A single campaign can configure separate creatives for the same utility and placement across different devices:
- `/jpg-to-png` + `TOP_CONTENT`:
  - `MOBILE` -> Creative A (320x50 banner)
  - `TABLET` -> Creative B (468x60 banner)
  - `DESKTOP` -> Creative C (728x90 leaderboard)

Device resolution is centralized on the backend via user-agent analysis with explicit client-side hint support.

---

## 4. Targeting Precedence Hierarchy
When multiple candidate rules match, specificity precedes priority, and priority precedes weighted rotation:

1. **Tier 1: Exact Utility Match** (`utilitySlugs` matches `slug` AND `placement` AND `device` AND `country`)
2. **Tier 2: Category Match** (`categorySlugs` matches category AND `placement` AND `device`)
3. **Tier 3: Placement Global** (`utilitySlugs` is empty AND `categorySlugs` is empty AND `placement` matches)
4. **Tier 4: Global Fallback Creative** (`isGlobalFallback === true` for placement)
5. **Tier 5: No-Ad** (`hasAd: false`)

Within any tier:
- Highest **Effective Priority** wins (`priorityOverride || campaign.priority`).
- Among candidates with identical effective priority, **Weighted Rotation** selects the creative according to relative weights (`weight`).

---

## 5. Frequency Capping & Redis Architecture
- **Storage**: Redis holds ephemeral impression counters keyed by `freq:camp:{campaignId}:sess:{sessionId}:{window}` with a sliding TTL (e.g. 86400 seconds for daily cap).
- **Atomic Enforcement**: Redis `INCR` and `EXPIRE` ensure race-condition-safe counter checks.
- **Fail-Open Strategy**: If Redis is offline or unreachable, frequency cap checks gracefully degrade (fail-open) to maintain ad delivery and prevent application failure.

---

## 6. Creative Types & Security Model
Supported creative types:
1. **`IMAGE`**: Validated image URL, dimensions, alt text, target click URL.
2. **`VIDEO`**: Validated video stream/MP4 URL, autoplay/muted controls.
3. **`HTML`**: Sanitized custom HTML string. JavaScript execution is contained, and dangerous schemes (`javascript:`, `data:text/html`) are prohibited.
4. **`IFRAME`**: Secure sandboxed iframe URL (`sandbox="allow-scripts allow-popups allow-forms"` without `allow-same-origin` or top-level navigation access).

---

## 7. Tracking & Analytics Contracts
- **Tracking Tokens**: The Ad Engine issues a tamper-evident token embedding `{ creativeId, campaignId, placementId, timestamp }`.
- **Impression Tracking (`POST /api/v1/ads/impression`)**: Verified token records an asynchronous impression in `ad_impressions` and increments the Redis frequency counter.
- **Click Tracking (`POST /api/v1/ads/click`)**: Verified token records a click in `ad_clicks` and safely resolves the authoritative destination URL from PostgreSQL `ad_creatives`.
