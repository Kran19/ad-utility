# Database Architecture Specification

## 1. Architectural Boundaries & Principles
- **Authoritative Persistence Layer**: PostgreSQL 16 is the sole database engine.
- **ORM & Data Access**: Prisma ORM is the exclusive data access layer.
- **Access Boundary**: Only the NestJS backend (`apps/backend`) connects to PostgreSQL via Prisma. The Next.js frontend NEVER connects directly to PostgreSQL.
- **Executable Code Boundary**: The database contains metadata, configuration, scheduling, and relational links ONLY. No executable TypeScript/JavaScript or arbitrary code strings are stored in the database.
- **Secret Isolation**: Secrets such as OpenAI API keys and JWT signing secrets are stored in server-side environment variables and NEVER persisted in database records.

---

## 2. Relational Domain Models & Entities

```
+--------------------------------------------------------------------------------------------------+
|                                        DATABASE DOMAINS                                          |
+-----------------------------------+----------------------------------+---------------------------+
| 1. AUTH & RBAC                    | 2. UTILITY METADATA              | 3. ADVERTISING ENGINE     |
| - User                            | - Utility                        | - AdCampaign              |
| - Role                            | - UtilityCategory                | - AdCreative              |
| - Permission                      |                                  | - AdPlacement             |
| - RolePermission                  |                                  | - AdTargetingRule         |
| - UserRole                        |                                  | - AdSchedule              |
| - AuditLog                        |                                  | - AdImpression            |
|                                   |                                  | - AdClick                 |
+-----------------------------------+----------------------------------+---------------------------+
| 4. AI TRACKING                    | 5. FIRST-PARTY TELEMETRY         | 6. PLATFORM SETTINGS      |
| - AiRequest                       | - AnalyticsEvent                 | - Setting                 |
+-----------------------------------+----------------------------------+---------------------------+
```

### Domain 1: Authentication & Role-Based Access Control (RBAC)
- `User`: Admin accounts, email (unique), passwordHash (bcrypt), isActive, lastLoginAt, timestamps.
- `Role`: System roles (`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST`), description.
- `Permission`: Granular permissions (e.g. `campaigns:create`, `utilities:publish`, `settings:update`).
- `RolePermission`: Many-to-many join table mapping permissions to roles.
- `UserRole`: Many-to-many join table mapping users to roles (supports primary and multi-role assignments).
- `AuditLog`: Immutable log of sensitive admin operations (action, entityType, entityId, actorUserId, actorEmail, actorIp, details JSONB, createdAt).

### Domain 2: Hybrid Utility Metadata Layer
- `UtilityCategory`: Slug (unique), name, description, displayOrder, icon, timestamps.
- `Utility`: Slug (unique index), name, description, categoryId, implementationMode (`LOCAL`, `SERVER`, `AI`), status (`ACTIVE`, `DRAFT`, `DISABLED`), isFeatured, displayOrder, seoTitle, seoDescription, canonicalUrl, faqContent (JSONB array), relatedSlugs (Text array), config (JSONB), version, timestamps.

### Domain 3: Advertising & Targeting Engine
- `AdCampaign`: Campaign container, name, status (`DRAFT`, `SCHEDULED`, `ACTIVE`, `PAUSED`, `EXPIRED`, `ARCHIVED`), priority (Int, e.g. 100, 80, 50), weight (Int for rotation), dailyImpressionCap (nullable Int), totalImpressionCap (nullable Int), startDate, endDate, timestamps.
- `AdCreative`: Reusable creative assets, name, type (`IMAGE`, `VIDEO`, `HTML`, `IFRAME`), mediaUrl, targetUrl, width, height, altText, customHtml, isGlobalFallback (Boolean), timestamps.
- `AdPlacement`: Standardized ad slots, code (unique enum/string: `HEADER_BANNER`, `TOP_CONTENT`, `AFTER_TOOL`, `MID_CONTENT`, `BOTTOM_CONTENT`, `SIDEBAR`, `MOBILE_STICKY`, `DESKTOP_STICKY`), name, description, supportedTypes (`CreativeType[]`), timestamps.
- `AdTargetingRule`: Multi-dimensional targeting linkage allowing different creatives for different devices (Mobile, Tablet, Desktop) on the same placement and utility.
  - `campaignId` (FK)
  - `placementId` (FK)
  - `creativeId` (FK, allows creative reuse)
  - `deviceTypes` (`DeviceType[]` - `MOBILE`, `TABLET`, `DESKTOP`)
  - `utilitySlugs` (Text array, empty = all utilities)
  - `categorySlugs` (Text array, empty = all categories)
  - `countries` (Text array, empty = all geos)
  - `priority` (Int override)
  - `weight` (Int for rotation)
  - `isActive` (Boolean)
- `AdSchedule`: Day-of-week and hour-of-day delivery windows (campaignId, dayOfWeek 0-6, startHour 0-23, endHour 0-23, timezone).
- `AdImpression`: Append-only impression telemetry (creativeId, campaignId, placementId, utilitySlug, deviceType, country, ipHash, userAgentHash, sessionToken, timestamp).
- `AdClick`: Append-only click telemetry (creativeId, campaignId, placementId, utilitySlug, deviceType, country, ipHash, sessionToken, timestamp).

### Domain 4: Centralized AI Usage Tracking
- `AiRequest`: Logs every AI proxy request (requestId UUID unique, utilitySlug, model, promptTemplate, inputTokens, outputTokens, totalTokens, estimatedCostUsd, durationMs, status `SUCCESS` | `FAILED` | `RATE_LIMITED`, errorMessage, ipHash, timestamp).

### Domain 5: First-Party Privacy-Conscious Telemetry
- `AnalyticsEvent`: High-volume event stream (eventType `page_view`, `tool_start`, `tool_complete`, `tool_error`, `ad_impression`, `ad_click`, `ai_request`), utilitySlug, placementCode, creativeId, sessionToken, anonymousId, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, metadata JSONB, timestamp.

### Domain 6: Platform Settings
- `Setting`: Key (unique string), value (text/JSONB), category, description, isEncrypted (Boolean), updatedAt.

---

## 3. High-Growth Tables & Data Retention Strategy
High-growth tables (`AnalyticsEvent`, `AdImpression`, `AdClick`, `AiRequest`, `AuditLog`) are indexed on timestamps and context foreign keys to enable fast range queries and rollups:
- **Partitioning Strategy**: At the current scale, standard B-tree composite indexing on `(timestamp, utilitySlug)` and `(timestamp, campaignId)` provides optimal throughput. Time-based table partitioning (e.g. monthly range partitioning) is documented for future phase scaling when table sizes exceed 10 million rows.
- **Privacy & Anonymization**: IP addresses and user agents are hashed using SHA-256 before insertion (`ipHash`, `userAgentHash`) to preserve user privacy and comply with GDPR/CCPA standards.
