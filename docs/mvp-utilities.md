# MVP Utilities Catalog Specification

## Overview
Phase 9 introduces 12 production MVP utilities across four core domains: **Image Processing**, **PDF Operations**, **Text Manipulation**, and **Generative AI Tools**.

All utilities adhere strictly to:
- Code-first `UtilityAdapter` contracts in `@ad-utility/shared`
- Standardized `UtilityRegistry` resolution mechanism
- Centralized `AiGatewayService` routing for AI features (zero direct provider SDK calls)
- Memory-safe, buffer-isolated file processing with authoritative magic bytes validation
- Centralized Ad Engine placements & First-Party Analytics telemetry

---

## 1. Complete Catalog Matrix

| # | Name | Slug | Category | Mode | Technology / Engine | Input Limits | Telemetry Events |
|:---|:---|:---|:---|:---|:---|:---|:---|
| 1 | JPG to PNG Converter | `jpg-to-png` | `image` | `SERVER` | `jpeg-js`, `pngjs` | Max 15MB, JPEG magic bytes | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 2 | PNG to JPG Converter | `png-to-jpg` | `image` | `SERVER` | `pngjs`, `jpeg-js` | Max 15MB, PNG magic bytes, quality (1-100) | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 3 | Image Compressor | `image-compressor` | `image` | `SERVER` | `jpeg-js`, `pngjs` | Max 15MB, JPEG/PNG | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 4 | PDF Compressor | `pdf-compressor` | `pdf` | `SERVER` | `pdf-lib`, `@napi-rs/canvas`, `zlib` (multi-stage content optimizer) | Max 25MB, PDF header, profile (`VISUALLY_LOSSLESS`, `BALANCED`, `EXTREME`) | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 5 | PDF Merge | `pdf-merge` | `pdf` | `SERVER` | `pdf-lib` (in-memory multi-doc) | 2–10 files, Max 50MB combined | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 6 | PDF Split | `pdf-split` | `pdf` | `SERVER` | `pdf-lib`, `jszip` | Max 25MB, range parser (`1-3,5,8-10`) | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 7 | PDF to JPG Converter | `pdf-to-jpg` | `pdf` | `SERVER` | `pdfjs-dist`, `@napi-rs/canvas`, `jszip` | Max 20MB, up to 20 pages | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 8 | Text Cleaner | `text-cleaner` | `text` | `LOCAL` | Pure deterministic TypeScript | Max 2MB text | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 9 | Case Converter | `case-converter` | `text` | `LOCAL` | Pure deterministic TypeScript | Max 2MB text | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR` |
| 10 | AI Humanizer | `ai-humanizer` | `ai` | `AI` | `AiGatewayService` | Max 50,000 chars, tone selection | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR`, `AI_REQUEST` |
| 11 | AI Paraphraser | `ai-paraphraser` | `ai` | `AI` | `AiGatewayService` | Max 50,000 chars, style selection | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR`, `AI_REQUEST` |
| 12 | AI Grammar Checker | `ai-grammar-checker` | `ai` | `AI` | `AiGatewayService` | Max 50,000 chars, structured JSON | `TOOL_START`, `TOOL_COMPLETE`, `TOOL_ERROR`, `AI_REQUEST` |

---

### PDF Compression Architecture & Forensic Engine
The PDF Compressor utilizes a deep forensic optimization pipeline:
1. **Forensic Analysis**: Catalogs every indirect object by byte size, filter, dimension, and type (Image XObjects, Form XObjects, Fonts, ICC Profiles, Content Streams, Metadata).
2. **Recursive Form XObject Traversal**: Recursively traverses `Resources -> XObject -> Form` hierarchies with visited reference sets to uncover nested presentation assets and background artwork.
3. **ColorSpace & Raw Bitmap Handling**: Decodes uncompressed 24-bit raw RGB bitmaps wrapped in `/FlateDecode` and `/ColorSpace [ /ICCBased ... ]` (dominant in Canva presentations), `/DeviceRGB`, `/DeviceGray`, and `/DeviceCMYK`.
4. **Content Classification & Deduplication**: Continuous-tone photographic images receive profile-tuned JPEG downsampling. Identical pixel streams are deduplicated using SHA-256 content hashing. Attached `/SMask` transparency channels are proportionally scaled.
5. **Compression Profiles**:
   - `EXTREME` (Default): 1440px/Q=65 down to 800px/Q=34 search ladder, target ≤1 MB when achievable.
   - `BALANCED` (Recommended): 1600px/Q=76 to 1440px/Q=70, strong compression with crisp layout & readability.
   - `VISUALLY_LOSSLESS` (High Fidelity): 2048px/Q=85, highest visual fidelity over size.
6. **Real Byte Measurement & Verification**: Serialized bytes are measured directly from `Buffer.length`. Every candidate is verified with `PDFDocument.load` to guarantee zero page count or structural regression. If output is not smaller, the original document is returned reporting `wasActuallyCompressed = false`.

---

## 2. Security & Resource Model

### File Security & Validation
1. **Magic Bytes Signature Validation**:
   - File extensions and client MIME headers are untrusted.
   - Every file undergoes byte-level signature inspection before decoding:
     - JPEG: `0xFF, 0xD8, 0xFF`
     - PNG: `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`
     - PDF: `%PDF-` (`0x25, 0x50, 0x44, 0x46, 0x2D`)
2. **Buffer Isolation & Zero File System Leakage**:
   - All conversion and stream manipulation runs entirely in RAM (`Buffer` / `Uint8Array`).
   - No temporary files are written to host or container disks.
   - Internal server filesystem paths are never exposed to clients.
3. **Filename Sanitization**:
   - Client filenames are stripped of path traversal attempts (`../`, `/`, `\`), null bytes, and non-whitelisted characters.
   - Output filenames are deterministically generated with appropriate extensions.

### AI Gateway Integration
- **Real OpenAI/provider integration**: DEFERRED (No external API calls are made; `OPENAI_API_KEY` is not required).
- **Mock/offline AI execution**: ENABLED (Deterministic offline mock engine generates representative outputs for all three AI tools).
- **AiGateway architecture**: IMPLEMENTED (Secret shielding, rate limiting, request tracking, and cost calculation ready for future provider activation).
- All AI utilities route exclusively through `AiGatewayService`.
- No utility directly imports the OpenAI SDK or reads `OPENAI_API_KEY`.
- Prompts are defined and maintained server-side.
- The AI Gateway enforces rate limiting (15 requests/minute per client), cost telemetry, and token budgets.
- All requests are logged to the PostgreSQL `ai_requests` table.

---

## 3. Frontend Architecture
- The public URL architecture follows `/<utility-slug>`.
- The Next.js App Router dynamic route `apps/frontend/src/app/[slug]/page.tsx` renders all 7 standard ad slots:
  - `HEADER_BANNER`
  - `TOP_CONTENT`
  - `AFTER_TOOL`
  - `MID_CONTENT`
  - `BOTTOM_CONTENT`
  - `MOBILE_STICKY`
  - `DESKTOP_STICKY`
- `ToolRunner.tsx` delegates to dedicated responsive workspace components:
  - `ImageWorkspace.tsx`: Drag & drop, preview, quality slider, download.
  - `PdfWorkspace.tsx`: Multi-file picker, range selector, scale controls, single/ZIP download.
  - `TextWorkspace.tsx`: Dual-pane editor, cleaning checkboxes, case toggle buttons, live counters, copy.
  - `AiWorkspace.tsx`: Tone/style selectors, character limits, loader, structured grammar issue cards.
