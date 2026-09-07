# ADR-001: Hybrid Utility Registry & Strict Sequential Phase Dependency Order

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-08-31
- **Deciders**: Lead Architect

---

## Context & Problem Statement
The platform hosts hundreds of utilities alongside a centralized Ad Engine, AI Gateway, Analytics system, and Admin control panel. Initial planning required alignment on two critical architectural questions:
1. **Utility Registry Model**: Should utilities be defined purely in code, purely in database records, or via a hybrid model?
2. **Phase Ordering & Dependency Graph**: In what exact order should foundation components (Ad Engine, AI Gateway, Analytics, Admin UI) be constructed relative to MVP utilities?

---

## Decision

### 1. Hybrid Utility Registry Architecture
We adopt a **Hybrid Utility Registry Model**:
- **Application Code Layer**: Implements executable tool logic (Canvas operations, PDF processing streams, AI Gateway invocation adapters) via a standardized `UtilityAdapter` TypeScript contract.
- **Database Metadata Layer**: PostgreSQL (`Utility` & `UtilityCategory` tables) stores configurable state: `name`, `slug`, `category`, `description`, `icon`, `publishedStatus`, `featuredStatus`, `ordering`, `seoTitle`, `seoDescription`, `faqContent`, `relatedUtilities`, and `config` JSON.
- **Rationale**: Keeps execution code type-safe, version-controlled, compiled, and secure against arbitrary database code injection while allowing non-technical admins to toggle tool publication, modify SEO copy, and reorder features via the Admin Panel.

### 2. Strict 13-Phase Sequential Dependency Order
We adopt the following non-negotiable 13-phase implementation sequence:
- **Phase 0**: Documentation / Repository Audit
- **Phase 1**: Foundation / Monorepo / Docker Environment
- **Phase 2**: PostgreSQL / Prisma ORM / Database Architecture
- **Phase 3**: Authentication / RBAC System
- **Phase 4**: Utility Engine / Hybrid Registry / Dynamic Routing
- **Phase 5**: Ad Engine / Ad Delivery API / `<AdSlot />` (Built BEFORE MVP Utilities)
- **Phase 6**: AI Gateway / OpenAI Integration (Built BEFORE AI Utilities)
- **Phase 7**: First-Party Analytics Engine (Built BEFORE MVP Utilities)
- **Phase 8**: Admin Control Panel (Built BEFORE MVP Utilities)
- **Phase 9**: Implementation of 10 Initial MVP Utilities
- **Phase 10**: SEO Engine & Performance Tuning
- **Phase 11**: Automated Testing & Security Hardening
- **Phase 12**: Production Readiness & Deployment

- **Rationale**: Building the Ad Engine (Phase 5), AI Gateway (Phase 6), and Analytics (Phase 7) prior to MVP utilities (Phase 9) ensures that every single utility page is natively authored with established `<AdSlot />` components, AI Gateway wrappers, and telemetry hooks rather than retrofitting infrastructure after tools are built.

---

## Consequences & Compliance Requirements
- Ad delivery API errors or analytics failure MUST NEVER interrupt or block core utility execution.
- Frontend components MUST NEVER execute OpenAI API calls or query database models directly.
- Adding new utilities requires: (1) authoring executable adapter in application code, (2) registering metadata, (3) creating tests, and (4) toggling status in DB. No core routing or infrastructure rewrites are permitted.
