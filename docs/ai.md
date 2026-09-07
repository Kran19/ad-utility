# AI Gateway Specification

## 1. Overview & Architectural Isolation
The AI Gateway is a centralized NestJS service (`apps/backend/src/ai-gateway`) acting as an isolated proxy between public utility endpoints and OpenAI's API.

**Core Rule**: No frontend client or individual utility component ever communicates directly with OpenAI. All AI utilities (`ai-humanizer`, `ai-summarizer`) MUST pass through the AI Gateway.

---

## 2. Key Gateway Responsibilities
- **Secret Shielding**: Exclusively manages `OPENAI_API_KEY` on the NestJS backend server.
- **Model Selection & Routing**: Automatically routes requests to target models (`gpt-4o-mini`, `gpt-4o`) based on utility configuration.
- **Prompt Engineering & Sanitization**: Enforces structured system prompts to prevent prompt injection attacks and ensure uniform response formatting.
- **Rate Limiting & Token Budgeting**: Implements IP-based sliding window rate limits and global daily token caps backed by Redis.
- **Timeout & Retry Policy**: Automatic exponential backoff retries for transient 503/429 OpenAI responses; timeout cap at 15 seconds.
- **Usage & Cost Tracking**: Logs every request duration, prompt tokens, completion tokens, estimated cost, and request ID to PostgreSQL (`AiRequest`).

---

## 3. Architecture Flow

```
Browser (User Input)
    │
    ▼
Next.js API Gateway Proxy
    │
    ▼
NestJS Backend (`/api/v1/ai/process`)
    ├── 1. Validate Input & IP Rate Limits (Redis)
    ├── 2. Retrieve Prompt Template for Target Utility
    ├── 3. Execute OpenAI API Request (Timeout & Retry)
    ├── 4. Log Tokens & Cost to DB (`AiRequest`)
    └── 5. Return Sanitized Response Envelope
```
