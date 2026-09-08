# AI Production & Gateway Architecture

## 1. Overview
The platform utilizes a centralized, server-side AI Gateway (`AiGatewayService`) that mediates all artificial intelligence interactions across the ecosystem. Frontends and utilities never interact with external LLM providers directly.

```
Frontend (AI Workspace UI)
    ↓
Backend API (/api/v1/utilities/:slug/execute or /api/v1/ai/generate)
    ↓
AiGatewayService (Central Gateway)
    ├── Input Validation (<= 50,000 chars, non-empty)
    ├── Rate Limiting (15 req/min per IP hash / session)
    ├── Daily Budget Guard (AI_DAILY_BUDGET_USD check)
    ├── Model Allowlist Check (SUPPORTED_AI_MODELS)
    └── Mode Dispatch:
        ├── AI_PROVIDER=mock (default) → Deterministic Mock Engine
        └── AI_PROVIDER=openai → Secure Server-Side OpenAI Chat Completions API
    ↓
Telemetry Persistence (PostgreSQL ai_requests, without storing raw prompt content)
    ↓
Sanitized Response / Error Mapping
```

---

## 2. Configuration & Modes

| Variable | Type | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | string | `mock` | `mock` (offline deterministic engine) or `openai` (live external provider). |
| `OPENAI_API_KEY` | secret | *none* | Runtime secret for OpenAI API. Backend-only; never committed or logged. |
| `AI_DEFAULT_MODEL` | string | `gpt-4o-mini` | Default production model. |
| `AI_ALLOWED_MODELS` | string | `gpt-4o-mini,gpt-4o,gpt-3.5-turbo,mock-ai` | Comma-separated server allowlist. |
| `AI_DAILY_BUDGET_USD` | float | `5.0` | Application-level daily spend ceiling. |
| `AI_PRICING_OVERRIDES_JSON` | JSON string | *none* | Optional JSON overrides for model pricing rates per 1M tokens. |

---

## 3. Model Governance & Pricing Table

Official baseline rates per 1,000,000 tokens:
- **`gpt-4o-mini`**: $0.15 Input / $0.60 Output (Default production model; cost-optimized)
- **`gpt-4o`**: $2.50 Input / $10.00 Output (High-reasoning workloads)
- **`gpt-3.5-turbo`**: $0.50 Input / $1.50 Output (Legacy compatibility)
- **`mock-ai`**: $0.00 Input / $0.00 Output (Offline / Testing)

---

## 4. Security & Privacy Protection
1. **Zero Secret Leakage**: `OPENAI_API_KEY` is injected strictly via backend runtime environment variables. It is absent from frontend bundles, Docker build arguments, and source repositories.
2. **Prompt & Response Privacy**: User prompt contents and AI output texts are **never persisted** to telemetry databases (`ai_requests`). Only metadata (token counts, duration, cost, status, utility slug) is recorded.
3. **Role Separation**: Prompt injection resistance is enforced by sending application guidelines in `{ role: 'system' }` and user data in `{ role: 'user' }`.
4. **Server-Side Constraints**: Prompts are capped at 50,000 characters; completion tokens are constrained to a server maximum (default 1,500, max 4,000).

---

## 5. Subsystem Isolation & Fail-Safe Guarantee
- If the AI provider experiences outages, timeouts (20s timeout enforced via `AbortController`), or rate limits (HTTP 429), the gateway safely maps the error to a friendly user envelope.
- **Non-AI utilities (images, PDFs, text utilities, ad engine, analytics, admin control panel) operate completely independently and will NEVER be degraded by AI provider failures.**

---

## 6. Key Rotation & Incident Response
1. **Rotation Procedure**:
   - Provision a new key in the provider management dashboard.
   - Update the secret in backend environment / secret store.
   - Restart the backend service container (`docker restart ad_utility_backend`).
   - Run health probe: `GET /api/v1/health` and test `GET /api/v1/ai/usage`.
   - Revoke the former key in the provider portal.
2. **Incident Shutdown**:
   - If abuse or abnormal cost spikes occur, immediately set `AI_PROVIDER=mock` or set `AI_DAILY_BUDGET_USD=0` to freeze live AI requests without affecting the rest of the platform.
