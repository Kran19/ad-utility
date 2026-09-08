# ADR-015: Real AI Provider Integration & Governance

## Status
Accepted / Completed (Phase 15)

## Context
Following the completion of core MVP utilities, production hardening, and growth optimization (Phases 0–14), Phase 15 activates a secure real external AI provider integration (OpenAI) while replacing the previous mock-only restriction with an explicit, configurable provider mode.

## Decisions

1. **Centralized Gateway Rule**:
   - All AI requests continue to route strictly through `AiGatewayService`. No direct provider calls are permitted from frontend components, utility adapters, or individual controllers.

2. **Explicit Provider Mode**:
   - Introduced `AI_PROVIDER` configuration (`'mock'` vs `'openai'`).
   - Default remains `mock` for deterministic development and offline automated test suites.
   - Production mode activates real provider execution only when `AI_PROVIDER=openai` and a valid backend-only secret `OPENAI_API_KEY` is present.

3. **Backend-Only Secret Isolation**:
   - `OPENAI_API_KEY` is strictly confined to server-side execution. It is never included in frontend builds, client payloads, telemetry logs, or image layers.

4. **Server-Side Model Governance & Allowlist**:
   - Implemented `SUPPORTED_AI_MODELS` allowlist (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`, `mock-ai`) with `gpt-4o-mini` as cost-effective default ($0.15 input / $0.60 output per 1M tokens).
   - Arbitrary model selection from clients is strictly rejected.

5. **Cost Protection & Daily Budget Guard**:
   - Implemented `AI_DAILY_BUDGET_USD` spending guard. Aggregates current UTC day spend from `ai_requests` and rejects calls with `AI_BUDGET_EXCEEDED` if the threshold is reached.
   - Enforced 50,000-character input limit and capped output tokens (default 1,500, max 4,000).

6. **Error Masking & Privacy Preservation**:
   - Provider errors (401, 429, timeout, network disconnect) are sanitized into user-facing HTTP status codes without leaking credentials or internal stack traces.
   - Prompts and response bodies are excluded from database logs (`ai_requests`).

7. **Fail-Safe Subsystem Isolation**:
   - AI provider failure is completely isolated from non-AI tools (image converters, PDF tools, text cleaners, ad engine, analytics, admin).

## Consequences
- The platform can safely execute real AI workloads when configured.
- Automated CI and test pipelines run deterministically and cost-free via mock mode.
- Non-AI utilities remain 100% reliable regardless of external LLM availability.
