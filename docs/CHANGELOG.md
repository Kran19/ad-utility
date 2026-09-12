# Changelog

## [Phase 29] - 2026-09-12
### Added
- Public User Registration API `POST /api/v1/auth/register` with email normalization, bcrypt hashing (10 salt rounds), non-admin default role, and audit logging (`USER_REGISTERED`).
- User Signup UI (`/signup`) with "Utility Universe" creative desktop split layout, responsive single-column mobile experience, real-time client validation, and workspace created transition.
- User Login UI (`/login`) with accessible password show/hide toggles and deferred recovery modal.
- User Account Dashboard (`/account`) with user profile identity card, plan details, 6-card utility launchpad, and 1-click billing/logout actions.
- Navbar dynamic authentication state rendering user initials and account dropdown menu.
- Automated test suite `test/auth-registration.spec.ts` covering validation, duplicate prevention, password privacy, role escalation rejection, and audit logging.
- Documentation: `docs/ADR-029-user-registration-authentication.md`, `docs/user-authentication.md`, and `docs/PHASE_29_VERIFICATION_REPORT.md`.
### Removed
- All credits functionality, starter credits, credit badges, and placeholder credit fields (explicitly excluded per Phase 29 scope).
