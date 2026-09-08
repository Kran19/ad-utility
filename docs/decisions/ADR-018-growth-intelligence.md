# ADR-018: Growth Intelligence & Experimentation Architecture

## Status
**ACCEPTED / FROZEN**

## Context
Following Phase 17's scale readiness and performance engineering, the platform possessed first-party telemetry collection and basic count aggregations. However, product operators lacked an integrated growth decision system capable of answering:
1. Which acquisition channels deliver users that actually complete and export utility jobs?
2. At which stage of the utility funnel do users experience friction and drop off?
3. Which ad placements and device categories deliver the highest CTR?
4. How can new CTA wording and workspace layouts be systematically tested using deterministic A/B experiments without random flickering?

## Decision
1. **Richer Conversion Funnel**: Implement multi-stage conversion telemetry (`PAGE_VIEW` $\to$ `TOOL_START` $\to$ `TOOL_COMPLETE` $\to$ `RESULT_DOWNLOAD`) with stage-by-stage drop-off rates and robust division-by-zero guards.
2. **Deterministic Session Hashing for A/B Experiments**: Use 32-bit FNV-1a hashing on `(experimentId + ':' + sessionToken)` with configurable variant weights, ensuring consistent user experiences across reloads and navigation without requiring database session state.
3. **Dedicated GrowthIntelligenceService**: Centralize SQL aggregation queries for acquisition channels, utility performance benchmarks, ad monetization metrics, and experiment results into a specialized admin service (`GrowthIntelligenceService`).
4. **Interactive Admin Growth Console**: Provide an enhanced tabbed/sectioned dashboard in the Next.js Admin Panel covering Funnel & Conversion, Acquisition, Utility Intelligence, Ad Monetization, A/B Experiments, and Live Telemetry.
5. **Strict Subsystem Isolation & Privacy**: Maintain SHA-256 hashing on IP/UA, 5KB metadata caps, zero raw prompt/file payload persistence, and zero external AI provider calls (`AI_PROVIDER=mock`).

## Consequences

### Positive
- Actionable business intelligence derived directly from real PostgreSQL telemetry.
- Zero extra database schema migrations required (operates on existing relational tables and JSON metadata).
- Deterministic experiment assignment with zero variant flickering for visitors.
- Clean separation of concerns between raw event ingestion and reporting aggregation.

### Negative / Trade-offs
- Experiment definitions are currently configuration-driven; full self-serve experiment creation in the UI will require dedicated tables in a future phase if needed.
- Complex multi-month funnel queries over millions of events will eventually benefit from materialized rollup tables if data volume increases significantly.
