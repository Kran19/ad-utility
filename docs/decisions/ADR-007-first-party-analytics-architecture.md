# ADR-007: First-Party Analytics Engine & Non-Blocking Telemetry

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-02
- **Deciders**: Lead Architect

---

## Context & Problem Statement
The platform requires accurate first-party telemetry across utility interactions, advertisement impressions/clicks, AI requests, and marketing attribution without relying on third-party tracking scripts (e.g. Google Analytics) that compromise user privacy or get blocked by ad blockers.
Crucially, telemetry MUST NOT introduce latency or become a failure point for utility execution.

---

## Key Decisions

### 1. Non-Blocking / Fault-Tolerant Collection
- **Decision**: Analytics operations are strictly non-blocking. Database insertion occurs asynchronously.
- **Rationale**: If the database or telemetry pipeline fails, user utility operations (e.g. converting a file or running an AI summary) must succeed uninterrupted.

### 2. Privacy-Preserving Identifier Model
- **Decision**: Raw IP addresses are never persisted; only 32-character SHA-256 hashes (`ipHash`) are stored. Anonymous session tokens (`sessionToken`) are used for session attribution without tracking personal identity.
- **Rationale**: Complies with GDPR/CCPA privacy standards and avoids storing sensitive PII.

### 3. Dedicated Relational Tables for Core Subsystems
- **Decision**: Retain `ad_impressions` and `ad_clicks` as canonical records for the Ad Engine, `ai_requests` as canonical records for AI Gateway costs, and `analytics_events` as the generalized telemetry event stream.
- **Rationale**: Avoids double counting and preserves high-fidelity domain indexes.

### 4. Role-Based Reporting Security
- **Decision**: Ingestion endpoints are public (protected by rate limiting and payload validation), while query and summary reporting endpoints require `ADMIN` or `SUPER_ADMIN` roles via `JwtAuthGuard` and `RolesGuard`.
- **Rationale**: Protects platform business metrics and telemetry data from unauthorized inspection.

---

## Consequences
- Fast sub-10ms event ingestion response times.
- Zero risk of telemetry failures breaking tool execution.
- Queryable foundations ready for Phase 8 Admin Control Panel.
