# Changelog

## [Phase 30] - 2026-09-15
### Added
- Standardized `AdPlacementSlot` frontend component enforcing canonical 8-placement inventory across Desktop, Tablet, and Mobile.
- 2-Column Responsive Layout on all 38+ utility pages (`apps/frontend/src/app/[slug]/page.tsx`) with Desktop `SIDEBAR` column, `DESKTOP_STICKY` corner placement, and `MOBILE_STICKY` bottom overlay.
- Standardized ad placements on Category pages (`/category/[categorySlug]`) and Homepage (`/`).
- Canonical Placement Inventory Device Matrix reference guide in Admin Ad Manager (`/admin/ad-manager`).
- Strict tool-level targeting rules in backend `AdSelectorService` preventing unassigned tools from serving unwanted global fallback ads.
- Automated test suite `apps/backend/test/ad-placement-inventory.spec.ts`.
- Documentation: `docs/ad-placement-inventory.md`, `docs/ADR-030-ad-placement-inventory.md`, and `docs/PHASE_30_VERIFICATION_REPORT.md`.

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
