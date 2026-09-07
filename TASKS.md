# TASKS TRACKING — UTILITY + AD PLATFORM

## Master Task Board

| Task ID | Title | Phase | Status | Priority | Dependencies | Affected Modules | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TASK-001 | Repository Audit, Rule Alignment & Documentation Update | Phase 0 | DONE | High | None | Root Docs | Aligned 13-phase order, hybrid registry, ADR-001, updated all docs |
| TASK-002 | Monorepo Structure & Shared Packages Initialization | Phase 1 | DONE | High | TASK-001 | Infra, Root | Monorepo layout (`apps/backend`, `apps/frontend`, `packages/shared`) |
| TASK-003 | Docker Compose & Container Environment Setup | Phase 1 | DONE | High | TASK-002 | Infra, Docker | `docker-compose.yml` with Postgres 16, Redis 7, Backend, Frontend |
| TASK-004 | NestJS Backend Scaffold & Core Config | Phase 1 | DONE | High | TASK-002 | Backend | NestJS app initializes with REST module structure, CORS & `/api/v1/health` |
| TASK-005 | Next.js Frontend Scaffold & Tailwind Setup | Phase 1 | DONE | High | TASK-002 | Frontend | Next.js 14+ App Router initialized with Tailwind CSS on port 3001 |
| TASK-006 | Prisma ORM & Relational Schema Definition | Phase 2 | DONE | High | TASK-004 | Backend, Prisma | Complete relational schema (Users, RBAC, Utilities, Ads, AI, Analytics) |
| TASK-007 | Database Migrations & Initial Seeding Script | Phase 2 | DONE | High | TASK-006 | Backend, Database | `prisma migrate dev` and deterministic seed script running inside Docker |
| TASK-008 | Authentication & RBAC Module | Phase 3 | DONE | High | TASK-006 | Backend Auth | JWT Auth, bcrypt password hashing, RBAC guards for 4 roles |
| TASK-009 | Utility Engine & Hybrid Registry Architecture | Phase 4 | DONE | High | TASK-005, TASK-006 | Backend/Frontend | Code adapters + DB metadata sync layer & universal `UtilityAdapter` contract |
| TASK-010 | Dynamic Catch-All Route & Standard Utility Template | Phase 4 | DONE | High | TASK-009 | Frontend | Next.js `/[slug]` dynamic renderer with slots for tool UI, Ads, FAQ, SEO |
| TASK-011 | Ad Engine & 12-Step Selection Algorithm | Phase 5 | DONE | High | TASK-006 | Backend Ad Module | 12-step targeting evaluation, priority weighting & 6-tier fallback algorithm |
| TASK-012 | Reusable Non-Blocking `<AdSlot />` Component | Phase 5 | DONE | High | TASK-011 | Frontend Ad Module | Asynchronous ad creative renderer (Image, Video, Custom HTML, iFrame) |
| TASK-013 | Centralized AI Gateway Module | Phase 6 | DONE | High | TASK-004 | Backend AI Module | OpenAI integration with secret shielding, rate limiting, token usage logging |
| TASK-014 | First-Party Analytics Telemetry Module | Phase 7 | DONE | Medium | TASK-006 | Backend/Frontend | Non-blocking event tracking for page views, tool usage, ad impressions/clicks |
| TASK-015 | Admin Control Panel Dashboard UI | Phase 8 | TODO | Medium | TASK-008, TASK-011 | Frontend Admin | Interactive control panel for campaigns, creatives, targeting, analytics |
| TASK-016 | Implementation of 10 Initial MVP Utilities | Phase 9 | TODO | High | TASK-010, TASK-012, TASK-013, TASK-014 | Frontend/Backend | 6 client utilities, 2 PDF server utilities, 2 AI utilities |
| TASK-017 | Dynamic Sitemap, FAQ Schema & SEO Engine | Phase 10 | TODO | Medium | TASK-010 | Frontend SEO | Auto-generated `sitemap.xml`, JSON-LD structured data per utility page |
| TASK-018 | Automated Test Suite & Security Hardening | Phase 11 | TODO | High | All | System-wide | Unit, integration & E2E tests, security audit verification |
| TASK-019 | Production Readiness & Container Deployment Setup | Phase 12 | TODO | High | TASK-018 | Docker, Infra | Multi-stage production docker setup, healthchecks, storage setup |
