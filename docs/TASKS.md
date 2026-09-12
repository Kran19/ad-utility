# Tasks

## Phase 29 Tasks — User Account Registration & Identity
- [x] Audit Phase 3 Auth and Phase 26 Billing/Entitlements infrastructure.
- [x] Exclude all credit models, credit ledgers, and credit fields.
- [x] Extend `@ad-utility/shared` auth contracts with `RegisterRequestDto`.
- [x] Create `RegisterDto` with class-validator validation, email normalization, and password length checks.
- [x] Implement `AuthService.register` with bcrypt hashing (10 rounds), default customer role (`roles: []`), and audit logging.
- [x] Add `@Public() @Post('register')` endpoint in `AuthController` issuing secure HTTP-only cookies.
- [x] Build `/signup` page with "Utility Universe" creative visual split layout, real-time client validation, and onboarding success transition.
- [x] Build `/login` page with accessible password toggles and deferred password recovery guidance.
- [x] Build `/account` dashboard displaying user identity, plan tier, utility quick launchpad, and direct billing links.
- [x] Update `Navbar.tsx` with dynamic session detection (initials avatar, account dropdown menu).
- [x] Write and pass automated test suite `apps/backend/test/auth-registration.spec.ts` (including privilege escalation prevention).
- [x] Run full platform regression test suites and verify production builds.
- [x] Generate ADR-029, verification reports, and guides.
