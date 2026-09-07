# Analytics & Attribution Specification

## 1. Overview & Non-Blocking Execution Guarantee
The platform features a first-party, privacy-preserving event telemetry system. It records core operational metrics without collecting personally identifiable user data (PII).

### Non-Blocking & Failure-Tolerant Rule
**Analytics is a non-critical secondary observer.** Telemetry calls MUST be non-blocking and failure-tolerant. If the analytics endpoint fails, times out, or throws a network error, the utility execution, page rendering, or AI processing MUST NOT be interrupted or failed.

---

## 2. Event Types
- `page_view`: Fired on Next.js route transition.
- `tool_start`: User submits files or text input for processing.
- `tool_complete`: Tool execution succeeds.
- `tool_error`: Tool execution fails (with sanitized error classification).
- `ad_impression`: Creative rendered successfully in dynamic `<AdSlot />`.
- `ad_click`: User clicks creative link.
- `ai_request`: AI utility processing triggered.

---

## 3. Attribution (UTM Parameters)
- Captures standard acquisition tags (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) into session state.
- Maps traffic sources to utility engagement and ad conversions.
