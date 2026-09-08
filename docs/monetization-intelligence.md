# Monetization Intelligence & Revenue Optimization

## 1. Overview & Objective
The **Monetization Intelligence & Revenue Optimization layer** builds on top of the Ad Engine, Analytics Engine, Growth Intelligence, and Admin Control Panel. It answers key monetization and yield optimization questions:
- Which ad placements, creative formats, devices, and utilities generate the strongest engagement and yield?
- How does ad exposure correlate with utility usage, task completion, and export downloads?
- What configuration adjustments can improve overall ad yield without hurting utility completion rates or user experience?

## 2. Core Principles & Truthful Metrics Policy
1. **Zero Fabricated Revenue**: Because the platform does not process payments or connect to third-party ad networks, no artificial dollar figures or currency metrics are fabricated.
2. **Observed vs Proxy Metrics**:
   - **Observed Metrics**: Ad impressions, verified ad clicks, observed CTR (`(clicks / impressions) * 100`), utility starts, completions, and export downloads.
   - **Proxy / Estimated Metrics**: Deterministic 0–100 Optimization Scores, Relative Device Engagement Index (`device CTR / platform CTR`), and Fill-Rate telemetry availability (`fillRateAvailable: false`).
3. **Advisory-Only Recommendations**: The recommendation engine is strictly advisory and non-destructive. It does not automatically modify ad priorities, disable creatives, or mutate campaign settings.

---

## 3. Mathematical Models & Formulas

### 3.1 Observed Click-Through Rate (CTR)
$$\text{CTR} = \begin{cases} \left(\frac{\text{clicks}}{\text{impressions}}\right) \times 100 & \text{if impressions} > 0 \\ 0.00\% & \text{if impressions} = 0 \end{cases}$$

### 3.2 Placement Optimization Score (0–100)
Calculates a bounded, deterministic score evaluating placement yield:
$$\text{Base CTR Score} = \min\left(70, \left(\frac{\text{CTR}}{2.0}\right) \times 50\right)$$
$$\text{Volume Health} = \min\left(30, \left(\frac{\text{impressions}}{100}\right) \times 30\right)$$
$$\text{Penalty} = \begin{cases} 20 & \text{if impressions} \ge 100 \text{ and CTR} < 0.2\% \\ 0 & \text{otherwise} \end{cases}$$
$$\text{Score} = \text{clamp}\left(0, 100, \text{round}(\text{Base CTR Score} + \text{Volume Health} - \text{Penalty})\right)$$
*If impressions < 10, the score is set to 50 with status `INSUFFICIENT_DATA`.*

Status Bands:
- `HIGH_PERFORMING`: Score $\ge 70$ or CTR $\ge 2.5\%$
- `AVERAGE`: $35 < \text{Score} < 70$
- `UNDERPERFORMING`: Score $\le 35$ or ($\text{impressions} \ge 50$ and $\text{CTR} < 0.5\%$)
- `INSUFFICIENT_DATA`: $\text{impressions} < 10$

### 3.3 Creative Optimization Score (0–100)
$$\text{Base CTR Score} = \min\left(60, \left(\frac{\text{CTR}}{2.0}\right) \times 40\right)$$
$$\text{Volume Score} = \min\left(40, \left(\frac{\text{impressions}}{50}\right) \times 40\right)$$
$$\text{Score} = \text{clamp}\left(0, 100, \text{round}(\text{Base CTR Score} + \text{Volume Score})\right)$$

### 3.4 Device Engagement Index
$$\text{Engagement Index} = \begin{cases} \frac{\text{Device CTR}}{\text{Overall Platform CTR}} & \text{if Overall CTR} > 0 \\ 1.00 & \text{otherwise} \end{cases}$$

---

## 4. Advisory Recommendations Engine Rules
The recommendation engine evaluates aggregated metrics across active placements, creatives, formats, devices, and utilities:
1. **Low CTR Placement Warning**: Triggered when a placement has $\ge 50$ impressions and $\text{CTR} < 0.5\%$. Advises evaluating visual contrast or repositioning slot closer to active utility content.
2. **High Performing Placement Highlight**: Triggered when a placement has $\ge 20$ impressions and $\text{CTR} \ge 3.0\%$. Advises allocating premium campaigns.
3. **Underperforming Creative Warning**: Triggered when an active creative asset has $\ge 50$ impressions and $\text{CTR} < 0.5\%$. Advises refreshing visual copy or CTA button color.
4. **Creative Format Disparity**: Identifies when interactive HTML formats significantly outperform static images ($\text{CTR}_{\text{HTML}} > 1.5 \times \text{CTR}_{\text{IMAGE}}$ with $\ge 30$ impressions each).
5. **Mobile Yield Gap Warning**: Identifies when Desktop CTR is more than double Mobile CTR ($\text{CTR}_{\text{Desktop}} > 2 \times \text{CTR}_{\text{Mobile}}$ with $\ge 30$ impressions each). Advises auditing mobile sticky banner tap targets.
6. **Utility Monetization Synergy**: Identifies high-performing utilities with $\ge 10$ tool starts, $\ge 70\%$ task completion, and $\ge 5.0\%$ ad engagement.

---

## 5. Caching & Performance Protections
- **Redis Caching**: Summaries cached under `admin:monetization:intel:${periodDays}` with 60-second TTL.
- **Fail-Open Policy**: If Redis is offline or disconnected, requests fall back directly to Prisma SQL queries without disruption.
- **Bounded Queries**: Date ranges clamped to `[1, 365]` days.
- **Privacy Assurance**: No IP addresses, user emails, passwords, or sensitive payloads are exposed in admin responses.
