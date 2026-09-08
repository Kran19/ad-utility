# ADR-008: Admin Control Panel Architecture & Governance

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-08
- **Deciders**: Lead Architect & Engineering Team

---

## 1. Context & Problem Statement
The platform requires a centralized, secure, role-based control plane to manage campaigns, creative assets, targeting rules, delivery schedules, utility metadata, platform settings, user accounts, and telemetry without exposing underlying database connections or private keys to the browser.

---

## 2. Key Decisions & Rationale

### 1. Separation of Admin Area (`/admin`) from Public Routes
- **Decision**: The administrative interface is isolated under `/admin/*` with its own Layout, Auth Context, and API client.
- **Rationale**: Isolates administrative complexity and bundle size from public consumer pages, preventing leakage of admin logic to general site visitors while optimizing public page load speeds.

### 2. Server-Side Authoritative Authorization
- **Decision**: All authorization decisions are strictly enforced on the NestJS backend via `JwtAuthGuard` and `PermissionsGuard` (`@RequirePermissions()`). Frontend UI element visibility is purely for UX.
- **Rationale**: The browser is an untrusted client. Direct API tampering or hidden element manipulation by unauthorized actors is immediately rejected with `401 Unauthorized` or `403 Forbidden`.

### 3. Reuse of Existing Phase 3 RBAC & Phase 2 Schema
- **Decision**: Reuse existing seeded permissions (`users:manage`, `campaigns:*`, `creatives:*`, `targeting:manage`, `utilities:*`, `settings:*`, `audit:read`, etc.) and the 4 canonical roles (`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST`).
- **Rationale**: Avoids schema drift, duplication of permission concepts, or fragmented authorization layers.

### 4. Mandatory Transactional Audit Logging
- **Decision**: Every administrative mutation (creation, update, status change, deletion) must record an immutable entry into PostgreSQL `audit_logs` identifying the actor, action, entity, and timestamp.
- **Rationale**: Ensures complete regulatory compliance, traceability, and operational accountability across all admin actions.

### 5. Metadata Configuration vs Code Execution Boundary
- **Decision**: The Admin Panel administers database metadata, categories, SEO tags, and status toggles (`ACTIVE`, `DRAFT`, `DISABLED`). It NEVER executes or uploads backend code.
- **Rationale**: Preserves the hybrid Utility Registry design where executable adapters (`LOCAL`, `SERVER`, `AI`) reside in compiled code, eliminating remote code execution (RCE) vulnerabilities.

### 6. Separation of Ad Engine Delivery from Admin Configuration
- **Decision**: The Admin API configures `ad_campaigns`, `ad_creatives`, `ad_targeting_rules`, and `ad_schedules`. The delivery pipeline (`GET /api/v1/ad-engine/deliver`) remains an independent, non-blocking 12-step evaluator.
- **Rationale**: Prevents heavy management operations from adding latency to real-time ad serving.

---

## 3. Consequences & Verification
- Clean, modular NestJS `AdminModule` with dedicated services for each sub-domain.
- Granular RBAC enforcement with `SUPER_ADMIN` universal access.
- Fully verified by automated test suites and live HTTP requests.
