# Utility Engine & Hybrid Registry Architecture Specification

## 1. System Overview
The Utility Engine powers all tools and utilities across the platform. It enforces a strict **Hybrid Registry Architecture**:
- **PostgreSQL Database**: Authoritative for metadata, life-cycle status (`ACTIVE`, `DRAFT`, `DISABLED`), categories, SEO tags, FAQ accordion items, display ordering, and safe config parameters.
- **Application Code**: Authoritative for executable tool adapters (`UtilityAdapter<TInput, TOutput>`), input/output validation, transformation algorithms, resource limits, error handling, and runtime execution.

### Security Guarantees
- **Zero Dynamic Code Execution**: No `eval()`, `new Function()`, dynamic database module imports, or executable file paths stored in PostgreSQL.
- **Explicit Code Registration**: Tools can only execute if a matching, statically-compiled TypeScript adapter is explicitly registered in the application registry.
- **Database Boundary**: Frontend Next.js client never connects to PostgreSQL or Prisma directly; all utility metadata and executions pass through strongly-typed API contracts.

---

## 2. UtilityAdapter Contract (`@ad-utility/shared`)

```typescript
export interface UtilityAdapter<TInput = any, TOutput = any> {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly mode: UtilityExecutionMode; // 'LOCAL' | 'SERVER' | 'AI'
  readonly resourceLimits?: UtilityResourceLimits;

  validateInput(input: unknown): TInput;
  validateOutput?(output: unknown): TOutput;
  execute(input: TInput, context: UtilityExecutionContext): Promise<TOutput> | TOutput;
}
```

---

## 3. Execution Modes
1. **`LOCAL` (Browser Execution)**:
   - Tool computations execute entirely in client-side memory using the shared `UtilityAdapter`.
   - Examples: JSON Formatter, Word Counter, simple string manipulations.
   - Eliminates unnecessary server roundtrips and guarantees 100% user data privacy.
2. **`SERVER` (NestJS Backend Execution)**:
   - Tool computations execute on the backend via `POST /api/v1/utilities/:slug/execute`.
   - Examples: Cryptographic text hashing, PDF merging/compression (Phase 9), server-side image processing.
   - Enforces timeout limits and payload size constraints.
3. **`AI` (Centralized AI Gateway Interface)**:
   - Tool executes via shielded AI Gateway adapter interface.
   - No direct client-side OpenAI API keys; all prompt orchestration and token management remain strictly shielded behind backend services.

---

## 4. Metadata Synchronization & Resolution Lifecycle
When a request is made for a utility:
1. **DB Record Check**: If no row exists in PostgreSQL `utilities` table -> `404 Not Found`.
2. **Status Check**: If `status` is `DRAFT` or `DISABLED` -> `404 Not Found` (hidden from public access).
3. **Adapter Availability**: If `status` is `ACTIVE`, checks whether an adapter is registered in `UtilityRegistry`.
4. **Execution Gate**:
   - If adapter is missing -> `503 Service Unavailable` (`ADAPTER_MISSING`).
   - If input exceeds `maxInputSizeBytes` -> `400 Bad Request` (`RESOURCE_LIMIT_EXCEEDED`).
   - If execution exceeds `maxExecutionTimeMs` -> `408 Request Timeout` (`EXECUTION_TIMEOUT`).

---

## 5. Dynamic Routing & Standard Page Structure (`apps/frontend/src/app/[slug]/page.tsx`)

Every utility uses the universal Next.js dynamic App Router route `/[slug]` with the standardized layout:

```
┌────────────────────────────────────────────────────────┐
│ Top Navigation & Breadcrumbs                           │
├────────────────────────────────────────────────────────┤
│ [AdSlotPlaceholder: HEADER_BANNER]                     │
├────────────────────────────────────────────────────────┤
│ Tool Hero Header (Name, Category, Badges)              │
├────────────────────────────────────────────────────────┤
│ [AdSlotPlaceholder: TOP_CONTENT]                       │
├────────────────────────────────────────────────────────┤
│ Tool Workspace Container (<ToolRunner />)              │
├────────────────────────────────────────────────────────┤
│ [AdSlotPlaceholder: AFTER_TOOL]                        │
├────────────────────────────────────────────────────────┤
│ How-To Guide & Documentation Section                   │
├────────────────────────────────────────────────────────┤
│ [AdSlotPlaceholder: MID_CONTENT]                       │
├────────────────────────────────────────────────────────┤
│ Dynamic FAQ Accordion (JSON-LD ready)                  │
├────────────────────────────────────────────────────────┤
│ [AdSlotPlaceholder: BOTTOM_CONTENT]                    │
├────────────────────────────────────────────────────────┤
│ Related Utilities Grid & Sticky Ad Placeholders        │
└────────────────────────────────────────────────────────┘
```
