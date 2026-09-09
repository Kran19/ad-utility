# AI Production Architecture & Operational Guide

## Overview

Phase 25 activates production-grade AI capabilities across the platform via the centralized `AiGatewayService`. This guide describes the architecture, configuration, security governance, rate limiting, budget protection, data privacy, and operational monitoring.

---

## 1. Centralized Architecture

All AI interactions flow exclusively through the centralized `AiGatewayService` (`apps/backend/src/ai/services/ai-gateway.service.ts`). Individual utilities and controllers never make direct external API calls or import third-party AI client libraries.

```
[ Frontend / API Client ]
            │
            ▼
[ Utility Controller / AI Controller ]
            │
            ▼
[ AiGatewayService (Centralized Gateway) ]
     ├─ Model Allowlist Validation
     ├─ Prompt Size / Token Caps
     ├─ Per-Identifier Rate Limiting (15 req/min)
     ├─ Daily Budget Ceiling Guard ($10.00/day)
     ├─ Sanitized Error Masking
     ├─ Ephemeral In-Memory Execution
     └─ Token Telemetry & Usage Logging
            │
    ┌───────┴────────┐
    ▼                ▼
[ Mock Provider ]  [ Real OpenAI API ]
(AI_PROVIDER=mock) (AI_PROVIDER=openai)
```

### Supported AI Utilities
1. `ai-humanizer`: Transforms rigid AI-generated text into natural, readable, human-styled prose.
2. `ai-paraphraser`: Rewrites text while preserving core meaning and tone.
3. `ai-grammar-checker`: Detects and corrects grammatical, spelling, and punctuation errors.

Non-AI utilities (such as `case-converter`, `text-cleaner`, `json-formatter`, `jpg-to-png`, etc.) have zero AI dependencies and operate completely independently of the AI Gateway.

---

## 2. Environment Configuration

The AI subsystem is governed entirely by server-side environment variables. **Under no circumstances should any AI credentials or API keys be passed to or exposed in the frontend.**

| Variable | Type | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | string | `mock` | Active provider: `mock` or `openai` |
| `OPENAI_API_KEY` | string | *unset* | OpenAI secret API key (`sk-...`). Backend only. |
| `OPENAI_MODEL` | string | `gpt-4o-mini` | Default model for completions |
| `AI_MAX_PROMPT_LENGTH` | integer | `50000` | Max allowed prompt characters |
| `AI_MAX_COMPLETION_TOKENS` | integer | `4096` | Max output tokens per request |
| `AI_DAILY_BUDGET_USD` | float | `10.00` | Hard daily spend ceiling |
| `AI_RATE_LIMIT_PER_MINUTE` | integer | `15` | Max requests per minute per identifier |

---

## 3. Provider Modes & Health States

The AI Gateway supports two operational modes:

### A. Mock Mode (`AI_PROVIDER=mock`)
- **Status**: `HEALTHY`
- **Is Configured**: `true`
- **Characteristics**: Instant deterministic response, zero external network calls, zero external cost.
- **Use Case**: Offline local development, unit tests, CI/CD regression runs, and environments without an OpenAI key.

### B. OpenAI Mode (`AI_PROVIDER=openai`)
- **Status (Key Missing)**: `NOT_CONFIGURED` (`isConfigured: false`)
- **Status (Key Present, unverified)**: `CONFIGURED` (`isConfigured: true`)
- **Status (Key Present, verified healthy)**: `HEALTHY` (`isConfigured: true`)
- **Status (Upstream downtime/5xx)**: `UNAVAILABLE` or `DEGRADED`
- **Characteristics**: Direct communication with `https://api.openai.com/v1/chat/completions` using Bearer authentication.

### Health Endpoints
- **Public**: `GET /api/v1/ai/health` (returns `AiProviderHealthDto` without sensitive data)
- **Admin**: `GET /api/v1/admin/ai/provider/health` (requires `ai:read` permission)

---

## 4. Security & Privacy Safeguards

### Backend-Only Credential Isolation
- The `OPENAI_API_KEY` is loaded only inside `AiGatewayService` via NestJS `ConfigService`.
- No API key is ever rendered in HTML, passed in JSON API responses, saved in client storage, or committed to source control.

### Credential Masking in Error Logs
All errors caught in the AI Gateway pass through automatic regex redaction:
- Replaces `sk-[A-Za-z0-9_-]{10,}` with `sk-***`
- Replaces `Bearer [A-Za-z0-9_.-]{10,}` with `Bearer ***`
This guarantees that upstream OpenAI error messages (which sometimes echo partial keys) cannot leak secrets to server logs or client callers.

### Ephemeral Prompt Processing (Zero Retention)
- User prompts and generated outputs are kept strictly in memory during request execution.
- Prompts and completions are **never** written to PostgreSQL `AiUsageLog`, `AnalyticsEvent`, or any server-side cache.
- Telemetry logs record only: `utilityId`, `model`, `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCostUsd`, `latencyMs`, and hashed session IDs.

---

## 5. Cost Governance & Budget Controls

### Estimated Pricing Model
Token costs are calculated using standard published OpenAI rates per 1,000 tokens:
- **`gpt-4o-mini`**: $0.00015 / 1k input tokens, $0.00060 / 1k output tokens
- **`gpt-4o`**: $0.00500 / 1k input tokens, $0.01500 / 1k output tokens
- **`gpt-3.5-turbo`**: $0.00050 / 1k input tokens, $0.00150 / 1k output tokens
- **`mock-ai`**: $0.00000

All admin dashboards and API responses explicitly label costs as `(ESTIMATED)` to maintain full financial truthfulness.

### Hard Daily Budget Ceiling
- The gateway tracks cumulative daily spending against `AI_DAILY_BUDGET_USD` (default $10.00).
- If today's spend exceeds the budget ceiling:
  - Budget status transitions to `EXCEEDED`.
  - Further completion requests are rejected immediately with HTTP 429 (`AI_DAILY_BUDGET_EXCEEDED`).
  - The platform is shielded against runaway automated attacks or unexpected bill spikes.

### Per-Identifier Rate Limiting
- A sliding-window in-memory limiter restricts callers to 15 requests per minute per identifier (session ID or IP hash).
- Excess requests receive HTTP 429 (`TOO_MANY_REQUESTS`).

---

## 6. Admin Control Panel

The Admin AI Usage dashboard (`/admin/ai-usage`) provides real-time visibility into AI operations:
- **AI Provider Status & Governance Card**: Displays active mode (`MOCK` vs `OPENAI`), health status badge, default model, allowed models, and reliability counters (OK vs ERR).
- **Daily Budget Meter**: Visual progress bar showing today's spend against the daily spending ceiling with budget status (`OK`, `WARNING`, `EXCEEDED`).
- **Cost Transparency**: Cost statistics and breakdown charts explicitly marked with `(ESTIMATED)`.
- **RBAC Enforcement**: Admin endpoints are protected by `ai:read` permission.
