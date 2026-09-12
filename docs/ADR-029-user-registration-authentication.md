# ADR-029: User Account Registration & Identity Security Architecture

## Status
Accepted / Complete / Frozen (Phase 29)

## Context
The platform required a public user registration, authentication, and account workspace experience (`/signup`, `/login`, `/account`) to allow visitors to register accounts, authenticate securely, view their profile, and interact with the utility toolkit.
Phase 3 (Auth/RBAC) and Phase 26 (Billing/Entitlements) are frozen subsystems.
In accordance with Phase 29 scope requirements, **all credits functionality is explicitly excluded / not implemented** in this phase.

## Decisions

### 1. Unified Authentication Stack & Zero Secondary Tables
- Public registration endpoint (`POST /api/v1/auth/register`) utilizes the existing PostgreSQL `User` model, bcrypt hashing, and JWT infrastructure.
- Zero secondary user or credential tables were created.
- Access and refresh tokens are delivered via secure HTTP-only cookies (`accessToken` with 15m lifetime, `refreshToken` with 7d lifetime).
- Client JavaScript never stores passwords, JWT tokens, or account credentials in `localStorage`.

### 2. Privilege Escalation Prevention & RBAC
- Public registration creates users without administrative `UserRole` bindings (`roles: []`).
- Role assignment is strictly server-controlled; registration payloads attempting to pass privileged roles (`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST`) are rejected or ignored.
- Newly registered accounts are verified through automated integration tests to receive 403 Forbidden on administrative endpoints.

### 3. Explicit Exclusion of Credit Functionality
- No credit models, starter credits, credit ledgers, credit balances, credit deduction, credit badges, or credit APIs are implemented in Phase 29.
- Clean architecture prepared without placeholder fields.

### 4. Deferred Email Verification & Password Recovery Policy
- Because the platform operates without an external SMTP provider configured in this environment, email delivery and password reset are explicitly documented as deferred.
- No fake verification tokens or deceptive "Verification email sent" UI patterns are displayed.

### 5. UI & Design System Cohesion
- A "Utility Universe" desktop split layout connects the platform's core tool categories (Image, PDF, Video, AI, QR, Developer) with a modern, accessible registration form.
- Real-time client-side feedback, accessible password toggles, and smooth onboarding transitions are implemented.

## Consequences
- Clean, auditable, server-authoritative account registration and login.
- Zero regression on existing Phase 0–28 functionality.
