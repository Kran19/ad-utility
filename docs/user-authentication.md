# User Authentication & Account Architecture

## 1. Overview
The platform provides a secure, unified user registration, authentication, and personal utility workspace identity across `/signup`, `/login`, `/account`, and session logout (`/logout`).

> [!NOTE]
> **Credits Scope Status**:
> As specified in Phase 29 requirements, **Credits and Credit Balances are NOT IMPLEMENTED** in this phase. The platform focuses entirely on secure account registration, session authentication, and personal identity.

## 2. Core Backend Endpoints

### Public Registration (`POST /api/v1/auth/register`)
- **Request Body**:
  ```json
  {
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "password": "SecurePassword123!",
    "termsAccepted": true
  }
  ```
- **Security & Processing**:
  - Email normalization: `trim().toLowerCase()`.
  - Password hashed with bcrypt (10 salt rounds).
  - Password length validation (min 8 chars, max 128 chars).
  - Server-assigned customer role (`roles: []` — zero administrative privilege escalation).
  - Auditable event log (`action: 'USER_REGISTERED'`).
  - Secure HTTP-only cookies issued (`accessToken` 15m, `refreshToken` 7d).

### User Authentication (`POST /api/v1/auth/login`)
- **Request Body**:
  ```json
  {
    "email": "alex@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Returns**: `ApiEnvelope<AuthResponseData>` + HTTP-only cookies.

### Current User Profile (`GET /api/v1/auth/me`)
- **Guarded**: Requires valid JWT access token (Bearer or HTTP-only cookie).
- **Returns**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid-v4",
      "email": "alex@example.com",
      "firstName": "Alex",
      "lastName": "Morgan",
      "isActive": true,
      "roles": [],
      "permissions": [],
      "createdAt": "2026-09-12T12:00:00.000Z"
    }
  }
  ```

### Session Logout (`POST /api/v1/auth/logout`)
- Clears `accessToken` and `refreshToken` HTTP-only cookies.

## 3. Frontend Architecture

### Routes
- `/signup`: "Utility Universe" creative visual split layout on desktop, single-column on mobile. Real-time feedback, password show/hide toggle, smooth onboarding transition card (*"✓ Workspace created. Welcome to your utility workspace. Your account is ready."*).
- `/login`: Cohesive authentication card with error mapping, accessible visibility toggles, and deferred recovery guidance.
- `/account`: User identity overview (avatar initials, name, email, member since date), plan tier, utility quick launchpad, and direct links to `/account/billing` and Sign Out.
- `Navbar.tsx`: Real-time session detection displaying user avatar and account dropdown menu for authenticated members, or `Sign in` / `Sign up` for visitors.

## 4. Security & Zero Client Token Authority
- Session tokens are stored exclusively in secure HTTP-only cookies.
- Client JavaScript / `localStorage` never stores tokens, passwords, roles, or authoritative account state.
- Email verification and password recovery are cleanly documented as deferred to prevent deceptive UI.
