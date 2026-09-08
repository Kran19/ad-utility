# ADR-009: MVP Utility Architecture & Execution Model

## Status
APPROVED & FROZEN (Phase 9)

## Context
Phase 9 requires introducing the first production MVP utility catalog consisting of 12 utilities spanning image processing, PDF operations, text transformations, and generative AI. The platform must maintain strict security, enforce deterministic resource limits, prevent remote code execution, adhere to the established code-first adapter contract, and support centralized monetization (Ad Engine) and telemetry (First-Party Analytics & AI Gateway).

## Decisions

### 1. Hybrid Adapter Architecture & Code Separation
- Executable behavior resides exclusively in compiled code adapters implementing the `UtilityAdapter<TInput, TOutput>` interface.
- Database records in PostgreSQL `utilities` represent metadata, status, SEO properties, and categorization, and **never execute arbitrary code**.
- Adapters are partitioned by environment:
  - `packages/shared`: Shared contracts, interfaces, and pure deterministic `LOCAL` adapters (`TextCleanerAdapter`, `CaseConverterAdapter`) that run in both browser and Node.js without backend dependencies.
  - `apps/backend`: `SERVER` and `AI` executable adapters (`JpgToPngAdapter`, `PngToJpgAdapter`, `ImageCompressorAdapter`, `PdfCompressorAdapter`, `PdfMergeAdapter`, `PdfSplitAdapter`, `PdfToJpgAdapter`, `AiHumanizerAdapter`, `AiParaphraserAdapter`, `AiGrammarCheckerAdapter`).

### 2. Execution Mode Classification
- **LOCAL**: Pure deterministic string operations (`text-cleaner`, `case-converter`). They execute directly in browser memory without requiring backend persistence, while also supporting server execution over HTTP.
- **SERVER**: Resource-intensive file operations requiring memory management and stream transformations (`jpg-to-png`, `png-to-jpg`, `image-compressor`, `pdf-compressor`, `pdf-merge`, `pdf-split`, `pdf-to-jpg`).
- **AI**: Generative language operations (`ai-humanizer`, `ai-paraphraser`, `ai-grammar-checker`).

### 3. File Processing & Security Guardrails
- **Magic Bytes Validation**: File extensions and client MIME headers are untrusted. Every image and PDF undergoes byte-level signature verification:
  - JPEG: `0xFF, 0xD8, 0xFF`
  - PNG: `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`
  - PDF: `%PDF-` (`0x25, 0x50, 0x44, 0x46, 0x2D`)
- **Memory Buffer Isolation**: File transformations execute entirely within memory buffers (`Buffer` / `Uint8Array`). No arbitrary disk paths are created or written to, eliminating path traversal risks and disk leakage.
- **Resource Limits**:
  - Images: Max 15MB file size limit.
  - PDFs: Max 25MB per file; max 50MB combined and max 10 files for merge.
  - Text/AI: Max 2MB for text; max 50,000 characters for AI prompts.

### 4. PDF Rasterization Pipeline
- Rasterizing PDF pages to JPEG (`pdf-to-jpg`) uses Mozilla's `pdfjs-dist` (legacy Node-compatible build) coupled with `@napi-rs/canvas` (precompiled high-performance Skia canvas).
- This provides pixel-accurate rendering inside Linux musl (Alpine Docker) and Windows without requiring heavyweight system packages like Cairo or Ghostscript.
- Multi-page conversions are packaged into standard ZIP archives in memory via `jszip`.

### 5. AI Gateway Integration & Provider Deferral
- **Real OpenAI/provider integration**: DEFERRED (No external OpenAI API key configured, no external network requests made).
- **Mock/offline AI execution**: ENABLED (Deterministic offline mock engine generates representative humanized text, paraphrases, and grammar corrections).
- **AiGateway architecture**: IMPLEMENTED (Secret shielding, rate limiting, request tracking, and cost calculation ready for future provider activation).
- All AI utilities dispatch strictly to `AiGatewayService.generateText()`.
- No utility directly imports the OpenAI SDK or reads provider credentials.
- Prompt templates are maintained server-side within the adapters.
- All AI requests benefit from centralized rate-limiting (15 req/min), token cost estimation, and telemetry persistence in the `ai_requests` table.

## Consequences
- 100% adherence to the code-first adapter contract.
- Zero client credential leakage and zero remote code execution vulnerabilities in the database.
- Complete isolation and deterministic error handling across all 12 MVP utilities.
