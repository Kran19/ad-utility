# Admin Control Panel Specification & Operating Architecture

## 1. System Overview & Core Principles
The Admin Control Panel is the centralized operational and management interface for the single-domain Utility + Ad Platform.
It provides full-lifecycle administration for:
- **Platform Health & Metrics Dashboard**
- **User Accounts & Role-Based Access Control (RBAC)**
- **Utility Database Metadata & Category Organization**
- **Ad Campaigns, Creatives, Placements, Targeting Rules & Pacing Schedules**
- **First-Party Analytics Telemetry & Performance Aggregation**
- **AI Gateway Token Utilization & USD Cost Accounting**
- **Platform Configuration & System Settings**
- **Immutable Security Audit Log Ledger**

### Absolute Architectural Guarantees
1. **Zero Direct Resource Access**: The frontend (`/admin/*`) strictly communicates via authenticated NestJS REST APIs (`/api/v1/admin/*`). The browser client never touches PostgreSQL, Prisma, Redis, OpenAI credentials, or server-side secrets.
2. **Server-Authoritative Authorization**: Frontend permission checks (`hasPermission()`, hidden UI elements) are purely UX enhancements. Every backend endpoint independently enforces authentication (`JwtAuthGuard`) and fine-grained permissions (`PermissionsGuard`, `@RequirePermissions()`).
3. **Transactional Mutation Auditing**: Every administrative creation, update, and deletion is recorded in PostgreSQL `audit_logs`, tracking the actor user ID, actor email, IP address, entity type, entity ID, and structured JSON diff metadata.
4. **Code vs Metadata Boundary**: The Admin Panel configures database metadata, publication states, and SEO tags. It NEVER uploads or executes arbitrary backend code. The hybrid Utility Registry remains code-first.
5. **Creative URL & Content Safety**: All creative URLs are strictly validated against unsafe schemes (`javascript:`, `vbscript:`, `data:`), and HTML snippets are sanitized before persistence.

---

## 2. Permission Matrix

| Resource Domain | Key Permissions | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| **Dashboard** | N/A (Authenticated) | `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST` | View platform-level KPIs and operational status |
| **Users & RBAC** | `users:manage`, `roles:manage` | `SUPER_ADMIN`, `ADMIN` | List, create, update users, and assign roles |
| **Utilities** | `utilities:read`, `utilities:create`, `utilities:update`, `utilities:publish`, `categories:manage` | `SUPER_ADMIN`, `ADMIN`, `EDITOR` | Manage tool metadata, publication status, categories, and SEO |
| **Ad Campaigns** | `campaigns:read`, `campaigns:create`, `campaigns:update`, `campaigns:delete` | `SUPER_ADMIN`, `ADMIN` | Configure campaigns, priorities, and pacing |
| **Ad Creatives** | `creatives:read`, `creatives:create`, `creatives:update`, `creatives:delete` | `SUPER_ADMIN`, `ADMIN` | Manage display banners, videos, HTML, and global fallbacks |
| **Targeting & Schedules** | `targeting:manage`, `placements:*` | `SUPER_ADMIN`, `ADMIN` | Device/category/utility targeting rules and day/hour pacing |
| **Analytics & Telemetry** | `analytics:read`, `analytics:export` | `SUPER_ADMIN`, `ADMIN`, `ANALYST` | Inspect first-party event streams and aggregate CTRs |
| **AI Usage** | `ai:read`, `ai:manage` | `SUPER_ADMIN`, `ADMIN`, `ANALYST` | Monitor model token consumption and estimated costs |
| **Platform Settings** | `settings:read`, `settings:update` | `SUPER_ADMIN`, `ADMIN` | Update platform parameters with secret masking |
| **Audit Logs** | `audit:read` | `SUPER_ADMIN`, `ADMIN`, `ANALYST` | Inspect immutable security mutation records |

---

## 3. Backend API Contract (`/api/v1/admin/*`)

| Method | Endpoint | Guard / Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/dashboard` | `JwtAuthGuard`, `RolesGuard` | Aggregated KPI counts, CTR, completion rate, AI cost |
| `GET` | `/admin/users` | `users:manage` | Paginated admin user list with search |
| `POST` | `/admin/users` | `users:manage` | Create new admin user with assigned roles |
| `PATCH` | `/admin/users/:id` | `users:manage` | Update user details, active state, or roles |
| `GET` | `/admin/users/roles` | `roles:manage` | List system roles and granular permissions |
| `GET` | `/admin/utilities` | `utilities:read` | Paginated utility metadata list |
| `POST` | `/admin/utilities` | `utilities:create` | Register new utility metadata |
| `PATCH` | `/admin/utilities/:id` | `utilities:update` | Update metadata, SEO, FAQs, or status |
| `GET` | `/admin/utilities/categories` | `utilities:read` | List utility categories |
| `POST` | `/admin/utilities/categories` | `categories:manage` | Create utility category |
| `GET` | `/admin/ads/campaigns` | `campaigns:read` | Paginated campaigns list with status filters |
| `POST` | `/admin/ads/campaigns` | `campaigns:create` | Create ad campaign |
| `PATCH` | `/admin/ads/campaigns/:id` | `campaigns:update` | Update campaign priority, caps, or status |
| `DELETE` | `/admin/ads/campaigns/:id` | `campaigns:delete` | Delete ad campaign |
| `GET` | `/admin/ads/creatives` | `creatives:read` | Paginated creatives list with format filter |
| `POST` | `/admin/ads/creatives` | `creatives:create` | Create creative asset (Image/Video/HTML/iFrame) |
| `PATCH` | `/admin/ads/creatives/:id` | `creatives:update` | Update creative metadata or assets |
| `DELETE` | `/admin/ads/creatives/:id` | `creatives:delete` | Delete creative asset |
| `GET` | `/admin/ads/placements` | `placements:read` | List all standardized placement slots |
| `GET` | `/admin/ads/targeting` | `targeting:manage` | List multi-device targeting rules |
| `POST` | `/admin/ads/targeting` | `targeting:manage` | Create targeting rule |
| `DELETE` | `/admin/ads/targeting/:id` | `targeting:manage` | Delete targeting rule |
| `GET` | `/admin/ads/schedules` | `campaigns:read` | List campaign delivery schedules |
| `POST` | `/admin/ads/schedules` | `campaigns:update` | Create day/hour schedule |
| `DELETE` | `/admin/ads/schedules/:id` | `campaigns:update` | Delete schedule |
| `GET` | `/admin/analytics/overview` | `analytics:read` | Platform telemetry summary & event breakdown |
| `GET` | `/admin/ai/overview` | `ai:read` | AI requests, model breakdown, and cost telemetry |
| `GET` | `/admin/settings` | `settings:read` | List platform settings with secret masking |
| `PATCH` | `/admin/settings/:key` | `settings:update` | Update setting value |
| `GET` | `/admin/audit-logs` | `audit:read` | Paginated, filterable audit log timeline |

---

## 4. Frontend Admin Navigation & Route Structure
- `/admin`: Dashboard with 8 KPI cards, quick links, and security policy overview.
- `/admin/campaigns`: Campaign management table, filters, status toggles, and create modal.
- `/admin/creatives`: Creative asset gallery with live previews, format filters, and URL validation.
- `/admin/placements`: Placement slots and supported creative formats.
- `/admin/targeting`: Multi-device and category targeting rules matrix.
- `/admin/schedules`: Day-of-week and UTC hour window scheduler.
- `/admin/utilities`: Utility metadata and category manager with publication status toggles.
- `/admin/users`: User management table, role assigner, and account status toggles.
- `/admin/analytics`: First-party telemetry event distribution and tool traffic metrics.
- `/admin/ai-usage`: AI request metrics, token counts, and USD cost accounting.
- `/admin/settings`: Platform settings editor with secret masking and JSON validation.
- `/admin/audit-logs`: Searchable, filterable audit log timeline.
- `/admin/login`: Secure administrative authentication page.
