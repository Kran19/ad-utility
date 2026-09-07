# Centralized AI Gateway Architecture & Model Governance

## 1. Executive Summary
The Centralized AI Gateway is the single, authoritative entry point for all generative AI operations across the platform.
Individual utilities (e.g. AI Summarizer, AI Rewriter, AI Humanizer) and client interfaces **never** access third-party LLM providers (OpenAI) directly, nor do they possess API keys or secrets.

---

## 2. Core Architectural Guarantees
1. **Zero Secret Leakage**: `OPENAI_API_KEY` and LLM credentials are strictly confined to the NestJS backend runtime. No keys are exposed in frontend bundles or responses.
2. **Model & Cost Governance**: Centralized token limits, prompt templating, cost calculations (input/output token pricing per model), and daily token budgets.
3. **Usage Telemetry & Auditability**: Every single AI request (successful, rate-limited, or failed) is recorded in PostgreSQL `ai_requests` with prompt token count, completion token count, estimated cost in USD, duration in ms, IP hash, and request ID.
4. **Rate Limiting & Abuse Prevention**: Enforces sliding window rate limits per IP/Session using Redis/in-memory counters to prevent budget exhaustion and abuse.
5. **Provider Resilience & Offline Fallback**: Pluggable provider architecture with built-in retry backoff, timeout handling, and deterministic mock fallback for offline/development/test environments.

---

## 3. Pricing Matrix & Cost Calculation
The gateway calculates estimated USD cost based on published model token rates:
- **`gpt-4o-mini`**: $0.15 / 1M input tokens, $0.60 / 1M output tokens
- **`gpt-4o`**: $5.00 / 1M input tokens, $15.00 / 1M output tokens
- **`gpt-3.5-turbo`**: $0.50 / 1M input tokens, $1.50 / 1M output tokens
- **`mock-ai`**: $0.00 (Offline testing)

---

## 4. Request Lifecycle Sequence
```
Client (Utility Execution)
        │
        ▼ POST /api/v1/ai/generate
 1. Rate Limit & Daily Budget Check (Redis / DB)
        │
 2. Prompt & System Message Validation
        │
 3. Provider Resolution (OpenAI API / Mock Engine)
        │
 4. Execution with Timeout (e.g. 15,000ms max)
        │
 5. Token Counting & Cost Computation
        │
 6. Usage Logging (ai_requests in PostgreSQL)
        │
        ▼
 Response (Clean structured JSON)
```
