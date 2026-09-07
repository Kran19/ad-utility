# Authentication & Role-Based Access Control (RBAC) Specification

## 1. System Overview
The Authentication & RBAC module secures all administrative interfaces, sensitive API endpoints, and platform operational functions:
- **Authentication**: JWT-based stateless authentication with dual-token architecture (short-lived access tokens + long-lived refresh tokens) with optional HTTP-only cookie support.
- **Password Security**: Salted bcrypt password hashing (10+ rounds).
- **Authorization**: Granular multi-role RBAC enforcement using NestJS Decorators (`@Roles()`, `@RequirePermissions()`, `@Public()`, `@CurrentUser()`) and Guards (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`).
- **Audit Logging**: Automatic recording of authentication attempts (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `TOKEN_REFRESH`) with IP address and user-agent metadata into PostgreSQL `audit_logs`.

---

## 2. Token Architecture
- **Access Token**:
  - Expiry: 15 minutes (`JWT_EXPIRES_IN=15m`)
  - Signed with: `JWT_SECRET`
  - Payload: `{ sub: userId, email, roles: RoleType[], permissions: string[] }`
  - Transmission: `Authorization: Bearer <token>` header or `accessToken` cookie
- **Refresh Token**:
  - Expiry: 7 days (`JWT_REFRESH_EXPIRES_IN=7d`)
  - Signed with: `JWT_REFRESH_SECRET`
  - Payload: `{ sub: userId, email }`
  - Transmission: `POST /api/v1/auth/refresh` body or `refreshToken` cookie

---

## 3. RBAC Roles & Hierarchy

| Role | Description | Key Permissions |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Full platform authority | All permissions including `users:manage`, `roles:manage`, `settings:update` |
| `ADMIN` | Campaign and operational management | `campaigns:*`, `creatives:*`, `targeting:manage`, `utilities:*`, `settings:read` |
| `EDITOR` | Content & tool metadata management | `utilities:create`, `utilities:update`, `utilities:publish`, `categories:manage` |
| `ANALYST` | Read-only reporting & telemetry | `analytics:read`, `analytics:export`, `ai:read`, `audit:read` |

---

## 4. Endpoints & API Contract

### Authentication API (`/api/v1/auth`)
- `POST /api/v1/auth/login` (Public): Authenticates email and password, returning tokens and profile.
- `POST /api/v1/auth/refresh` (Public): Refreshes expired access tokens.
- `POST /api/v1/auth/logout` (Public): Clears authentication cookies.
- `GET /api/v1/auth/me` (Protected): Retrieves current user profile with active roles and permissions.

---

## 5. Security & Privacy Guarantees
- Passwords are never returned in responses or stored in plaintext.
- Failed logins log structured metadata into `audit_logs` without leaking whether the email or password was invalid.
- Account deactivation (`user.isActive = false`) immediately blocks login attempts.
