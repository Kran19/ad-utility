# Business Intelligence, Revenue Attribution & Ad Optimization

## 1. Overview & Architecture
The **Business Intelligence, Revenue Attribution & Ad Optimization layer** composes Growth Intelligence (Phase 18) and Monetization Intelligence (Phase 19) into an executive decision-support system. It provides holistic visibility across acquisition quality, multi-touch conversion attribution, utility business value, ad yield efficiency, and actionable optimization opportunities.

```text
Acquisition Channels (UTM / Organic)
                 ↓
    First-Party Funnel Telemetry
                 ↓
    Growth Intelligence (Phase 18)
                 ↓
 Monetization Intelligence (Phase 19)
                 ↓
Business Intelligence & Attribution (Phase 20)
                 ↓
Prioritized Advisory Opportunities
```

---

## 2. Core Principles & Data Truth Rule
1. **Zero Fabricated Revenue Guarantee**: If the platform has no external billing integration, no artificial currency, ROAS, CAC, or financial profits are manufactured. All reporting returns `revenueAvailable: false` and uses deterministic **business value proxy metrics** ($0–100$).
2. **Non-Causal Observational Language**: Observational findings (e.g. ad exposure vs tool completion) are strictly described using terms such as "associated with" and "observed alongside", reserving causal attribution exclusively for controlled A/B experiments.
3. **Advisory-Only Optimization**: Recommendations provide clear rationale, metrics, current values, and actionable suggestions without automatically mutating campaign priorities, schedules, or tool settings.

---

## 3. Mathematical Scoring Models

### 3.1 Platform Business Health Score (0–100)
Composes 4 core health pillars into an executive health indicator:
$$\text{Health Score} = \text{clamp}\left(0, 100, \text{round}\left(0.25 \cdot \text{AcqQuality} + 0.35 \cdot \text{FunnelHealth} + 0.25 \cdot \text{MonetizationEfficiency} + 0.15 \cdot \text{ReliabilityHealth}\right)\right)$$

- `AcquisitionQuality`: Average Acquisition Quality Score across active channels.
- `FunnelHealth`: $\min(100, (\text{ConversionRate} / 25\%) \times 100)$
- `MonetizationEfficiency`: $\min(100, (\text{Overall CTR} / 2.5\%) \times 100)$
- `ReliabilityHealth`: Error-free execution index ($95–100$).

Status Bands:
- `EXCELLENT`: Score $\ge 80$
- `HEALTHY`: $60 \le \text{Score} < 80$
- `NEEDS_ATTENTION`: $40 \le \text{Score} < 60$
- `CRITICAL`: $\text{Score} < 40$

### 3.2 Acquisition Quality Score (0–100)
Evaluates the conversion depth of incoming traffic channels:
$$\text{Quality Score} = \text{clamp}\left(0, 100, \text{round}\left(\text{CompScore} + \text{DlScore} + \text{AdScore} + \text{VolScore}\right)\right)$$
- $\text{CompScore} = \min(40, (\text{CompletionRate} / 70) \times 40)$
- $\text{DlScore} = \min(30, (\text{DownloadRate} / 40) \times 30)$
- $\text{AdScore} = \min(20, (\text{CTR} / 2.0) \times 20)$
- $\text{VolScore} = \min(10, (\text{Visits} / 20) \times 10)$
*If channel visits < 5, score = 50 with status `INSUFFICIENT_DATA`.*

### 3.3 Utility Opportunity Score (0–100)
Ranks utilities by their combined growth and monetization headroom:
$$\text{Opportunity Score} = \min\left(100, \text{round}\left(\min(30, \frac{\text{Traffic}}{50} \times 30) + \min(40, \frac{\text{CompletionRate}}{80} \times 40) + \min(30, \frac{\text{AdCTR}}{3.0} \times 30)\right)\right)$$

---

## 4. Prioritized Optimization Opportunities Engine
Rule-based advisory engine generating structured opportunities:
- **Acquisition Quality Disparities**: Highlights channels with high volume but low completion ($< 30\%$) for targeting refinement, and identifies high-converting niche channels for budget scaling.
- **Utility Bottleneck Detection**: Identifies tools with high landing traffic but low completion ($< 40\%$) to recommend UX and input hint improvements.
- **Utility Monetization Headroom**: Identifies tools with high completion ($\ge 70\%$) but low ad engagement ($< 0.5\%$) to recommend post-tool result placements.
- **Ad Inventory Optimization**: Flags underperforming placements ($< 0.5\%$ CTR with $\ge 50$ impressions) and highlights top-tier high-yield slots ($\ge 3.0\%$ CTR).
- **A/B Experiment Rollout**: Identifies leading variants with sufficient sample sizes ($\ge 20$ exposures) for graduation.

---

## 5. Performance, Caching & Privacy
- **Redis Caching**: Summaries cached under `admin:bi:summary:${periodDays}` with 60-second TTL and fail-open fallback.
- **Query Bounds**: Date parameters clamped to $[1, 365]$ days with top-N limits to prevent combinatorial explosion.
- **Privacy Assurance**: No IP addresses, user emails, passwords, or raw session payloads are exposed.
