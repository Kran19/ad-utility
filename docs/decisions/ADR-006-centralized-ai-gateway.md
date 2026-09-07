# ADR-006: Centralized AI Gateway & Model Governance

- **Status**: APPROVED / ACCEPTED
- **Date**: 2026-09-02
- **Deciders**: Lead Architect

---

## Context & Problem Statement
Utilities on the platform (AI Summarizer, AI Rewriter, etc.) require generative AI capabilities.
Directly calling OpenAI from frontend code or scattering raw API keys across individual utility handlers would cause security vulnerabilities, uncontrollable API costs, lack of audit telemetry, and vulnerability to token exhaustion attacks.

---

## Key Decisions

### 1. Centralized Gateway Architecture
- **Decision**: All generative AI requests MUST route through `AiGatewayService` in NestJS.
- **Rationale**: Keeps `OPENAI_API_KEY` private, enforces token budgets and rate limits centrally, and standardizes telemetry.

### 2. Dual-Provider Support with Deterministic Mock Provider
- **Decision**: The gateway supports both live OpenAI API HTTP calls and a built-in deterministic `MockAiProvider` for development, automated testing, and offline modes.
- **Rationale**: Allows 100% reliable CI/CD test automation without incurring real API charges or failing when external OpenAI servers are unreachable.

### 3. Comprehensive Per-Request Usage Telemetry
- **Decision**: Every AI invocation persists an entry to PostgreSQL `ai_requests` logging input tokens, output tokens, total tokens, USD cost estimate, execution duration, and request status (`SUCCESS`, `FAILED`, `RATE_LIMITED`).
- **Rationale**: Provides granular telemetry for analytics and admin reporting without coupling execution to frontend components.

---

## Consequences
- 100% secret containment on backend.
- Rate limiting and budget caps protect the platform from unexpected OpenAI billing spikes.
- AI utility adapters interface with a standardized backend contract.
