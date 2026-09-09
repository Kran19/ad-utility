# ADR-025: Real OpenAI Provider Activation & Production AI Architecture

## Status
Accepted

## Context
Prior phases established an initial centralized AI Gateway (`AiGatewayService`) and support for three generative AI utilities (`ai-humanizer`, `ai-paraphraser`, `ai-grammar-checker`). In Phase 25, the platform required activation of production-grade AI capabilities, enabling real OpenAI model routing while maintaining zero vendor lock-in, zero credential exposure, robust cost/budget governance, and strict privacy guarantees.

Key requirements:
1. **Single Authoritative Gateway**: All AI requests across the platform must route exclusively through the centralized `AiGatewayService`. No ad-hoc HTTP clients, direct OpenAI SDK usage in controllers, or bypass paths are permitted.
2. **Deterministic Dual-Mode Support**: Seamless operation in both `AI_PROVIDER=mock` (deterministic, zero latency, free testing baseline) and `AI_PROVIDER=openai` (live external API) modes.
3. **Backend-Only Credential Isolation**: The `OPENAI_API_KEY` credential must reside exclusively in secure backend server environment variables. It must never be exposed to the client, embedded in frontend bundles, stored in the database, or leaked in logs or error traces.
4. **Provider Health & Configuration State**: Clean separation between credentials present (`CONFIGURED`) and live connectivity confirmed (`HEALTHY`). When credentials are absent, the provider status must report `NOT_CONFIGURED` without crashing or throwing unhandled errors.
5. **Rigorous Governance & Cost Safety**: Enforced model allowlist (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`, `mock-ai`), payload input limits (50,000 characters), maximum completion token caps, per-user/per-session rate limiting (15 req/min), and an automatic daily spending ceiling ($10.00/day).
6. **Data Privacy Policy**: Zero retention of raw user prompts or generated text in persistent databases or analytics event payloads. Internal telemetry logs only anonymized metadata (token counts, latency, model name, estimated cost).
7. **Cost Transparency**: All internally calculated dollar figures must be explicitly labeled `(ESTIMATED)` since exact upstream provider billing and volume discounts are determined exclusively by OpenAI invoices.

## Decisions

1. **Centralized AiGatewayService as Authoritative Abstraction**:
   - `AiGatewayService` serves as the sole provider orchestration layer.
   - All AI utilities (`ai-humanizer`, `ai-paraphraser`, `ai-grammar-checker`) invoke `aiGatewayService.generateCompletion(...)`.
   - In non-AI utilities (e.g. `text-cleaner`, `case-converter`), zero AI dependencies or calls are executed.

2. **Backend-Only Security & Credential Masking**:
   - `OPENAI_API_KEY` is retrieved strictly via `ConfigService.get('OPENAI_API_KEY')` on the backend.
   - Error handling incorporates regex-based credential masking (`sk-[A-Za-z0-9_-]{10,}` and `Bearer [A-Za-z0-9_.-]{10,}`) to redact any sensitive token sequences before errors are logged or returned to callers.
   - Public and admin health endpoints return only boolean flags (`isConfigured: boolean`) and masked provider metadata.

3. **Provider Health State Semantics**:
   - `mock` mode: `status: 'HEALTHY'`, `isConfigured: true`.
   - `openai` mode without API key: `status: 'NOT_CONFIGURED'`, `isConfigured: false`.
   - `openai` mode with API key: `status: 'CONFIGURED'`, `isConfigured: true` (transitioning to `HEALTHY` only following an actual live smoke/health check).
   - Network failure or upstream downtime: `status: 'UNAVAILABLE'` or `'DEGRADED'`.

4. **Strict Model Allowlist & Validation**:
   - Allowed models: `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`, and `mock-ai`. Requests with unapproved models are rejected immediately with HTTP 400 (`UNSUPPORTED_AI_MODEL`).
   - Maximum prompt length capped at 50,000 characters to prevent prompt-injection buffer attacks or unintended massive token consumption.
   - Maximum completion tokens capped at 4,096 tokens per request.

5. **Rate Limiting & Daily Budget Ceiling**:
   - Per-session / per-IP rate limiting enforces a maximum of 15 requests per minute with sliding-window tracking.
   - Daily spending limit is enforced via in-memory and database usage tracking against a configurable daily ceiling (`AI_DAILY_BUDGET_USD`, default $10.00). When spend reaches 100%, subsequent requests are rejected with HTTP 429 (`AI_DAILY_BUDGET_EXCEEDED`).

6. **Privacy & Ephemeral Processing**:
   - Raw user input prompts and AI-generated outputs are processed entirely in memory.
   - No prompts or responses are written to PostgreSQL `AiUsageLog` or `AnalyticsEvent` tables. Only token usage, utility ID, session hash, latency, and estimated cost are persisted.

7. **Transparent Estimated Cost Tracking**:
   - Token costs are computed using published baseline rates per 1,000 tokens (e.g., $0.00015 input / $0.00060 output for `gpt-4o-mini`).
   - All admin dashboards and API endpoints label cost values as `(ESTIMATED)`.

## Consequences

### Positive
- Platform is completely ready for real production OpenAI traffic immediately upon injecting `OPENAI_API_KEY` into server environment variables.
- Dual-mode architecture enables full offline development, regression testing, and CI/CD without API keys or costs.
- Comprehensive security safeguards protect against runaway billing, token exhaustion attacks, and credential leakage.
- User data privacy is completely preserved by design.

### Negative / Trade-offs
- Without an active `OPENAI_API_KEY` in local/sandbox environments, live upstream OpenAI calls cannot be executed; live verification remains flagged as pending configuration while mock mode serves as the verified baseline.
