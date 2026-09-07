# ADR-003: JWT Dual-Token Authentication & Multi-Role RBAC Guards

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-02
- **Deciders**: Lead Architect

---

## Context & Problem Statement
Phase 3 requires establishing the administrative authentication and authorization architecture for the platform.
Key challenges:
1. Support both REST API client consumption (Bearer headers) and web browser dashboard authentication (secure cookies).
2. Enforce role and permission constraints without repetitive boilerplate across NestJS controllers.
3. Track security audit trails without compromising user privacy.

---

## Decisions

### 1. Dual-Token JWT Strategy
- Access tokens (15m expiry) carry the full user security context (`sub`, `email`, `roles`, `permissions`) to eliminate redundant database hits on every request.
- Refresh tokens (7d expiry) carry minimal subject payload and require database verification upon rotation to immediately enforce role revocations or account deactivations.

### 2. NestJS Guard & Reflector Hierarchy
- `JwtAuthGuard` checks `@Public()` metadata; when absent, verifies token signature and attaches `req.user`.
- `RolesGuard` checks `@Roles()` metadata; automatically grants access to `SUPER_ADMIN` and validates specific role requirements.
- `PermissionsGuard` checks `@RequirePermissions()` metadata; verifies user possesses all required permissions.

### 3. Integrated Audit Trails
- All authentication events (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `TOKEN_REFRESH`) record structured audit entries into PostgreSQL `audit_logs`.

---

## Consequences
- Admin control panel (Phase 8) and backend REST services can cleanly protect sensitive endpoints with `@Roles('ADMIN')` or `@RequirePermissions('campaigns:create')`.
- All automated tests in `apps/backend/test/auth.spec.ts` pass with 100% success.
