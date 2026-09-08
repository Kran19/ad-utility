# Privacy & Data Handling Policy

**Version:** 1.0.0  
**Phase:** 13 (Production Launch & Monetization Readiness)  
**Status:** IMPLEMENTED & DOCUMENTED  
**Jurisdiction Notice:** This document describes actual architectural data flows and security safeguards implemented within the application. It does not constitute formal legal counsel. Prior to commercial public launch in regulated jurisdictions (e.g., GDPR in the EU, CCPA/CPRA in California), independent legal and compliance review is required.

---

## 1. Core Architectural Privacy Principles

The platform follows a strict **privacy-by-design** posture:
1. **Zero Utility Input Persistence:** Files and text processed through conversion, compression, formatting, or AI utilities are evaluated exclusively in volatile memory and never stored in persistent databases, object stores, or disk.
2. **Pseudonymous Telemetry:** No Personally Identifiable Information (PII) such as raw IP addresses, physical names, email addresses, or phone numbers are ever logged or persisted in the analytics or ad delivery pipelines.
3. **Irreversible One-Way Hashing:** Network identifiers are hashed with SHA-256 before telemetry ingestion.
4. **First-Party Self-Hosted Telemetry:** The platform utilizes an in-house analytics and ad engine. No third-party behavioral trackers or external telemetry beacons are embedded.

---

## 2. Network Identifiers & Telemetry Ingestion

### A. IP Address Masking & Hashing
- **Raw IP Processing:** Incoming requests contain client IP addresses for network routing and rate limiting.
- **Hashing Transformation:** In the analytics telemetry pipeline (`apps/backend/src/analytics/`), the client IP address is concatenated with a server-side salt and hashed via `crypto.createHash('sha256')`.
- **Storage:** Only the resulting 64-character SHA-256 hexadecimal hash is stored in PostgreSQL (`analytics_events.ipHash`). The raw IP address is immediately discarded.

### B. User-Agent Masking & Hashing
- **Raw User-Agent:** Browsers provide device and browser signatures in the `User-Agent` HTTP header.
- **Hashing Transformation:** Similar to the IP address, User-Agent strings are parsed for device classification (`DESKTOP`, `MOBILE`, `TABLET`) and hashed with SHA-256 (`analytics_events.userAgentHash`).
- **Storage:** Raw user agent strings are not persisted to database event logs.

### C. Anonymous Session Identifiers
- **Client Storage:** The frontend analytics library (`apps/frontend/src/lib/analytics.ts`) generates a cryptographically random session identifier (`sessionToken`) stored exclusively in browser `sessionStorage`.
- **Scope & Expiry:** The `sessionToken` is scoped strictly to the current browser tab session and expires automatically upon tab closure. It does not persist across browser restarts and is not linked to user accounts.

### D. UTM Campaign Tracking
- Standard query parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) are ingested into analytics metadata strictly to assess inbound marketing channel efficacy.
- UTM strings are sanitised and capped at standard field lengths.

---

## 3. Utility Data Handling (Zero-Persistence Architecture)

| Utility Category | Input Handling | Memory Lifecycle | Persistent Storage |
| :--- | :--- | :--- | :--- |
| **Text Utilities**<br>(JSON, Base64, Case, Word Counter, Markdown, URL) | In-memory text buffer (capped at 5MB) | Evaluated in process memory; cleared after response completion | **NONE** (0 bytes persisted) |
| **Image Utilities**<br>(PNG/JPG conversion, compression) | `multipart/form-data` buffer in Node memory (capped at 10MB) | Processed via Sharp library; output streamed to client | **NONE** (0 bytes persisted) |
| **PDF Utilities**<br>(PDF split, PDF compress) | `multipart/form-data` buffer in Node memory (capped at 15MB) | Processed via `pdf-lib` in ephemeral memory | **NONE** (0 bytes persisted) |
| **AI Mock Utilities**<br>(Humanizer, Paraphraser, Grammar) | Ephemeral text string | Deterministic mock adapter transforms string in-memory | **NONE** (0 bytes persisted; mock requests logged anonymously) |

> [!IMPORTANT]
> The server does NOT maintain a file cache, disk upload directory, or cloud object bucket for utility inputs or outputs. Data exists only during the HTTP request lifecycle.

---

## 4. Cookies & Client-Side Storage Disclosure

The platform maintains an ultra-minimal storage profile:

| Storage Key | Type | Category | Purpose | Expiration / Scope |
| :--- | :--- | :--- | :--- | :--- |
| `access_token` | HTTP Cookie | Strictly Necessary (Admin Only) | Contains signed JWT for authenticated administrators accessing `/admin`. Flagged `HttpOnly`, `SameSite=Strict`, and `Secure` (in production). | 15 Minutes |
| `refresh_token` | HTTP Cookie | Strictly Necessary (Admin Only) | Enables secure rotation of admin authentication tokens. Flagged `HttpOnly`, `SameSite=Strict`, and `Secure` (in production). | 7 Days |
| `ad_session_id` | `sessionStorage` | Functional Telemetry | Correlates anonymous ad delivery, impression, and click events within a single browsing session. | Session (Tab closure) |
| `analytics_sess` | `sessionStorage` | Functional Telemetry | Correlates anonymous tool funnel events (`PAGE_VIEW` → `TOOL_START` → `TOOL_COMPLETE`). | Session (Tab closure) |

> [!NOTE]
> Public non-administrative users browsing utilities are **never issued tracking cookies** or persistent third-party profiling cookies.

---

## 5. Advertising Engine Telemetry & Monetization

### A. Ad Request & Targeting
- Ad selection is deterministic based on utility category, utility slug, and device type.
- No cross-site profiling, fingerprinting, or behavioral targeting algorithms are executed.

### B. Tracking Tokens
- Ad creatives are served with an encrypted, HMAC-SHA256 signed tracking token containing:
  - `creativeId`
  - `campaignId`
  - `placementId`
  - `placementCode`
  - `timestamp`
- Tokens expire in 24 hours. They do not encode user identity or IP addresses.

### C. Impression & Click Verification
- Impressions are beaconed via `navigator.sendBeacon` or standard `fetch` upon verified intersection observer triggers.
- Clicks are verified by the backend against the signed token before redirecting to the advertiser's authoritative destination URL.
- No third-party tracking scripts or remote ad tags (e.g., Google AdSense, prebid.js) are active.

---

## 6. Third-Party Advertising Provider Policy

**Current Operational Status:**
- **Zero external ad networks** (AdSense, Mediavine, Raptive, AppLovin) are integrated or connected.
- All displayed creatives originate from first-party internal campaigns or house fallback configurations.

**Policy for Future Third-Party Activation:**
If an external advertising network or Header Bidding wrapper is introduced in future phases:
1. A formal Consent Management Platform (CMP) supporting TCF v2.2 must be implemented.
2. An explicit opt-in/opt-out cookie banner must be activated for EU/UK and California traffic.
3. Third-party provider data transfer agreements and privacy declarations must be updated.

---

## 7. Data Retention & Purge Schedules

| Data Domain | Retention Window | Storage Engine | Purge Mechanism |
| :--- | :--- | :--- | :--- |
| **Analytics Funnel Events** | 90 Days | PostgreSQL (`analytics_events`) | Automated daily partition drop / cron purge |
| **Ad Impressions & Clicks** | 180 Days | PostgreSQL (`ad_impressions`, `ad_clicks`) | Aggregated into daily metrics tables; raw logs purged |
| **Security Audit Logs** | 365 Days | PostgreSQL (`admin_audit_logs`) | Retained for security compliance and incident review |
| **Redis Cache Keys** | 5–60 Minutes | In-Memory Redis | Automatic TTL expiration |
| **Utility Inputs/Outputs** | 0 Seconds | Ephemeral Process Memory | Immediate garbage collection after response |

---

## 8. Compliance Roadmap for Operators

Before opening the platform to commercial billing or end-user monetization:
- [ ] Implement geofenced Consent Management Platform (CMP) if required by jurisdiction.
- [ ] Publish public Privacy Policy link in global website footer pointing to this disclosure.
- [ ] Designate a Data Protection Contact / Officer.
- [ ] Review external CDN logging configuration (e.g., Cloudflare IP retention).
