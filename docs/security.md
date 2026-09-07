# Security Architecture Specification

## 1. Overview
Security is enforced at all boundaries of the application:
- Secret protection (API keys isolated on server side).
- Role-Based Access Control (RBAC) enforced on backend endpoints.
- Input validation, file upload limits, and output sanitization.

---

## 2. Threat Vector Mitigation Matrix

| Vector | Control Strategy |
| :--- | :--- |
| Secret Leakage | `OPENAI_API_KEY` and DB credentials strictly server-side inside Docker environment. |
| SQL Injection | Parameterized queries via Prisma ORM. |
| XSS | React default output encoding, DOMPurify for HTML creative renders. |
| CSRF | SameSite secure cookies and JWT Bearer authorization headers. |
| API Rate Abuse | Redis sliding-window rate limiters per IP / endpoint. |
| Upload Vulnerabilities | Strict MIME type validation, file size limits, safe filename generation. |
| Unauthorized Admin Access | NestJS Auth Guard + RBAC Guard (`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ANALYST`). |
