# ADR-005: Centralized Deterministic Ad Engine & Multi-Tier Targeting

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-02
- **Deciders**: Lead Architect

---

## Context & Problem Statement
The platform requires a centralized ad selection and delivery engine that delivers targeted ads across utilities while ensuring:
1. Exact device-level targeting (e.g. separate creatives for Mobile, Tablet, and Desktop for the same tool and placement).
2. Strict non-blocking fault-tolerance: advertising failures must NEVER break utility pages or utility execution.
3. Deterministic selection with weighted rotation and multi-tier fallbacks.
4. Ephemeral frequency capping with Redis without hot-path database locks.
5. High security against XSS, open redirects, and client tracking spoofing.

---

## Key Architectural Decisions

### 1. Centralized Backend Selection vs Frontend Logic
- **Decision**: All ad targeting, priority scoring, rotation, and frequency cap evaluations are executed strictly within NestJS backend services.
- **Rationale**: Keeps targeting rules, campaign budgets, and advertiser configurations private; prevents ad-blocker tampering with business logic; ensures consistent behavior across all web and mobile clients.

### 2. Multi-Tier Specificity Precedence
- **Decision**: Candidate rules are evaluated in deterministic tiers:
  `Exact Utility Match > Category Match > Placement Global > Global Fallback Creative > No-Ad`.
- **Rationale**: An advertiser paying for exact tool placement (e.g., `/jpg-to-png`) always takes precedence over category or global ads.

### 3. Ephemeral Redis Frequency Capping with Fail-Open Degrade
- **Decision**: Redis stores session-based daily/lifetime impression counters. If Redis is unavailable, the engine fails open (serves the ad without capping error) rather than failing the request.
- **Rationale**: Prioritizes user experience and platform uptime.

### 4. Signed Tracking Tokens for Impression & Click Verification
- **Decision**: Ad delivery responses return a signed `trackingToken`. Impression and click endpoints require this token to record events.
- **Rationale**: Prevents malicious bots or rogue clients from artificially inflating impression/click counts or manipulating destination redirect URLs.

---

## Consequences
- Fast, non-blocking ad delivery API with sub-25ms response time.
- Standard Next.js `<AdSlot />` components asynchronously mount without delaying page hydration or utility tools.
