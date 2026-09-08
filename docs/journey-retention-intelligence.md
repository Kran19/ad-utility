# Journey & Retention Intelligence Architecture

## Overview
Phase 21 introduces an **Advanced Growth, Retention & User Journey Intelligence layer** to the Utility + Ad Platform monorepo. It transforms first-party anonymous telemetry events into privacy-preserving journey graphs, retention cohorts, session-depth distributions, and advisory growth recommendations without user account profiling or cross-site tracking.

---

## Core Principles & Privacy Framework

1. **Anonymous Session Paradigm**:
   - All journey tracking uses client-side ephemeral session tokens (`sessionToken`) generated anonymously in browser localStorage.
   - No personally identifiable information (PII), email addresses, raw IP addresses, or browser fingerprints are recorded or analyzed.
   - Raw session tokens are never exposed in administrative APIs, dashboard tables, or log outputs.

2. **Data Truth & Non-Causal Semantics**:
   - Zero manufactured retention rates, cohort sizes, or financial metrics.
   - Metrics are computed strictly from observed first-party events (`PAGE_VIEW`, `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR`, `RESULT_DOWNLOAD`, `AD_IMPRESSION`, `AD_CLICK`, `EXPERIMENT_EXPOSURE`).
   - Insufficient telemetry is explicitly classified with `status: 'INSUFFICIENT_DATA'` and confidence level `INSUFFICIENT_DATA` when samples fall below minimum thresholds (`MINIMUM_SAMPLE_SIZE = 5`).
   - Observational phrasing ("associated with", "observed alongside") is strictly enforced over unsupported causal claims.

---

## Architectural Composition

```text
┌────────────────────────────────────────────────────────┐
│                   Admin UI Dashboard                   │
│        (Journey & Retention Intelligence Tab)          │
└───────────────────────────┬────────────────────────────┘
                            │
              GET /api/v1/admin/analytics/journey
                            │
┌───────────────────────────▼────────────────────────────┐
│              JourneyIntelligenceService                │
├───────────────────────────┬────────────────────────────┤
│   GrowthIntelligence      │  MonetizationIntelligence  │
│   (Funnel & Acquisition)  │  (Ad Yield & Placements)   │
└───────────────────────────┬────────────────────────────┘
                            │
            PostgreSQL / Prisma Aggregations
        (analytics_events, utilities, ad_campaigns)
                            │
               Redis Cache (60s Fail-Open)
            admin:journey:summary:${periodDays}
```

---

## Mathematical Models & Scoring Formulas

### 1. Journey Quality Score (0–100)
A deterministic multi-factor indicator of platform workflow completion and multi-tool exploration:

$$\text{Journey Quality Score} = \min\left(100, \text{Round}\left(w_{\text{comp}} + w_{\text{dl}} + w_{\text{mu}} + w_{\text{ret}} + w_{\text{err}}\right)\right)$$

Where:
- **Task Completion Weight ($35\%$)**: $(\text{Completion Rate} / 100) \times 35$
- **Result Download Weight ($25\%$)**: $(\text{Download Rate} / 100) \times 25$
- **Multi-Utility Usage Weight ($20\%$)**: $(\text{Multi-Utility Session Rate} / 100) \times 20$
- **Returning Visitor Weight ($15\%$)**: $(\text{Returning Visitor Rate} / 100) \times 15$
- **Error-Free Execution Weight ($5\%$)**: $\max\left(0, 1 - \frac{\text{Error Rate}}{100}\right) \times 5$

**Classification Rating**:
- $80 - 100$: `EXCELLENT`
- $60 - 79$: `GOOD`
- $40 - 59$: `FAIR`
- $0 - 39$: `NEEDS_ATTENTION`
- $< 5 \text{ total sessions}$: `INSUFFICIENT_DATA`

---

### 2. Retention Health Score (0–100)
A deterministic index representing repeat visitation and cohort progression over time:

$$\text{Retention Health Score} = \min\left(100, \text{Round}\left(w_{D1} + w_{D7} + w_{\text{ret}} + w_{\text{prog}}\right)\right)$$

Where:
- **Day 1 Retention Weight ($35\%$)**: $(\text{Overall D1 Rate} / 100) \times 35$
- **Day 7 Retention Weight ($30\%$)**: $(\text{Overall D7 Rate} / 100) \times 30$
- **Returning Visitor Rate ($20\%$)**: $(\text{Returning Visitor Rate} / 100) \times 20$
- **Multi-Session Progression ($15\%$)**: $(\text{Multi-Utility Rate} / 100) \times 15$

**Status Classification**:
- $\ge 70$: `HEALTHY`
- $40 - 69$: `MODERATE`
- $< 40$: `NEEDS_ATTENTION`
- $< 5 \text{ sample units}$: `INSUFFICIENT_DATA`

---

## Dimension Breakdown

### 1. Anonymous Retention Cohorts
Groups session tokens by their first observed active date and calculates subsequent activity at intervals:
- **D1 Retention**: Tokens with activity $\ge 1 \text{ day}$ after origin.
- **D7 Retention**: Tokens with activity $\ge 7 \text{ days}$ after origin.
- **D14 Retention**: Tokens with activity $\ge 14 \text{ days}$ after origin.
- **D30 Retention**: Tokens with activity $\ge 30 \text{ days}$ after origin.
- **Cohort Maturity**: Cohorts with $< 5$ sessions are tagged `INSUFFICIENT_DATA`.

### 2. Session Depth Intelligence
Categorizes sessions into discrete depth buckets (`1 utility`, `2 utilities`, `3 utilities`, `4+ utilities`) and correlates depth with:
- Tool completion rates
- Result download/export rates
- Ad impression volume and CTR

### 3. Cross-Utility Flow Graph
Analyzes sequential tool visits in the same session and exposes the top 20 transition pathways ($A \to B$) with:
- Transition count
- Transition rate ($\% \text{ of source users continuing to target}$)
- Target tool completion rate
- Target download rate

---

## Advisory Opportunities Engine

The engine emits non-destructive, explainable recommendations across 5 operational areas:
- `ACQUISITION`: Highlights channels with high volume but low return rate.
- `CROSS_UTILITY`: Identifies high-converting utility pathways and low multi-tool exploration rates.
- `RETENTION`: Flags low D1/D7 cohort retention and suggests navigation history shortcuts.
- `UTILITY`: Pinpoints tools with high starts but weak cross-tool next steps.
- `EXPERIMENT`: Highlights variants associated with above-average task progression.

All opportunities include:
- `id`, `area`, `severity` (`HIGH`, `MEDIUM`, `LOW`, `INFO`), `entity`, `reason`, `metric`, `currentValue`, `recommendedAction`, `confidenceLevel` (`HIGH`, `MEDIUM`, `INSUFFICIENT_DATA`).

---

## Endpoints & Security

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/v1/admin/analytics/journey` | `GET` | `analytics:read` | Complete journey and retention intelligence summary |
| `/api/v1/admin/analytics/journey/opportunities` | `GET` | `analytics:read` | Standalone advisory journey opportunities |

- **Date Range Bounds**: `days` clamped between `1` and `365` (default: `30`).
- **Caching**: Stored in Redis under `admin:journey:summary:${periodDays}` with 60s TTL; fail-open if Redis is unavailable.
