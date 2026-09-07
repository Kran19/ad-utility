# ADR-002: Relational Database Architecture & Ad Targeting Entity Model

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-02
- **Deciders**: Lead Architect

---

## Context & Problem Statement
Phase 2 requires establishing the production PostgreSQL schema using Prisma ORM. Two fundamental structural decisions were evaluated:
1. **Ad Targeting Entity Model**: How should device targeting, placements, campaigns, and creatives be linked so that different creatives can be delivered for Mobile, Tablet, and Desktop for the exact same placement and utility, while allowing creative assets to be reused?
2. **RBAC Cardinality**: Should user-role mapping be 1:1 or M:N?

---

## Decisions

### 1. Ad Targeting Rule Matrix
We decouple `AdCreative` from a single campaign or placement by introducing `AdTargetingRule` as the delivery resolution junction.
- `AdCampaign` defines the high-level business campaign (schedule window, budget/impression caps, default priority).
- `AdCreative` defines the reusable visual/media creative asset.
- `AdTargetingRule` links `campaignId`, `placementId`, and `creativeId` with multi-dimensional criteria (`deviceTypes: DeviceType[]`, `utilitySlugs: text[]`, `categorySlugs: text[]`, `countries: text[]`, `priorityOverride: Int?`, `weight: Int`).
- **Rationale**: This allows an admin to assign Creative A to Mobile, Creative B to Tablet, and Creative C to Desktop under the same Campaign and Placement for any specific utility slug without duplicating asset records.

### 2. Multi-Role RBAC Mapping (`UserRole` & `RolePermission`)
We adopt an M:N join model for Users ↔ Roles and Roles ↔ Permissions:
- `User` ↔ `UserRole` ↔ `Role`
- `Role` ↔ `RolePermission` ↔ `Permission`
- **Rationale**: Provides maximum future flexibility for enterprise administration (e.g. an admin with both `EDITOR` and `ANALYST` capabilities) while maintaining clear role boundaries for the initial standard roles (`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST`).

---

## Consequences
- NestJS Ad Engine (Phase 5) will query `AdTargetingRule` matching active campaigns and target parameters, enabling deterministic 12-step targeting evaluation.
- All high-growth telemetry tables (`AdImpression`, `AdClick`, `AiRequest`, `AnalyticsEvent`) use SHA-256 IP hashing and composite timestamp indexes for query efficiency and privacy compliance.
