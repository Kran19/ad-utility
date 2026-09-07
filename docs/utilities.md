# Utility Registry & Engine Specification

## 1. Hybrid Utility Registry Architecture
The platform operates on a **Hybrid Architecture**:
1. **Code Implementation Layer**: Executable tool adapters (`LOCAL`, `SERVER`, `AI`) reside strictly in compiled application code.
2. **Database Metadata Layer**: PostgreSQL (`Utility` & `UtilityCategory` tables) manages dynamic metadata, status toggles (`ACTIVE`, `DRAFT`), featured flags, display ordering, SEO titles/descriptions, FAQ content, related tools, and configuration settings.

Database records NEVER contain executable code strings.

```
Code Implementation Adapter (LOCAL / SERVER / AI)
                       │
                       ▼
               Utility Registry
                       │
                       ▼
          Database Metadata & Config
                       │
                       ▼
              Public Utility Page
```

---

## 2. Universal Utility Adapter Contract Interface

Every utility implementation must satisfy the `UtilityAdapter` interface:

```typescript
export type ExecutionMode = 'LOCAL' | 'SERVER' | 'AI';

export interface UtilityMetadata {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  status: 'ACTIVE' | 'DRAFT' | 'DISABLED';
  executionMode: ExecutionMode;
  requiresAI: boolean;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  faq: Array<{ question: string; answer: string }>;
  relatedSlugs: string[];
  config?: Record<string, any>;
  version: string;
}

export interface UtilityAdapter<TInput = any, TOutput = any> {
  metadata: UtilityMetadata;
  validateInput(input: TInput): Promise<boolean> | boolean;
  execute(input: TInput, context?: Record<string, any>): Promise<TOutput>;
  handleError(error: Error): { userMessage: string; errorCode: string };
}
```

---

## 3. PDF Processing Strategy (Separate Manipulation vs Compression)
Heavy PDF operations are architecturally separated:
- **PDF Manipulation (Merging / Splitting)**: Lightweight stream manipulation handled server-side using `pdf-lib`.
- **PDF Compression**: Requires stream downsampling and object stream compaction. Light files processed directly via `pdf-lib` stream optimizer; heavy files offloaded to isolated background worker tasks to ensure HTTP handler responsiveness.

---

## 4. Initial 10 MVP Utilities Overview

| Utility | Slug | Category | Execution Mode | Strategy & Infrastructure |
| :--- | :--- | :--- | :--- | :--- |
| JPG to PNG | `jpg-to-png` | image | LOCAL | Browser Canvas API |
| PNG to JPG | `png-to-jpg` | image | LOCAL | Browser Canvas API |
| Image Compressor | `image-compressor` | image | LOCAL | Browser JS Compression |
| Image Resizer | `image-resizer` | image | LOCAL | Browser Canvas API |
| JSON Formatter | `json-formatter` | developer | LOCAL | Syntax Highlighting & Formatting |
| Word Counter | `word-counter` | text | LOCAL | Text Metrics Engine |
| PDF Compressor | `pdf-compressor` | pdf | SERVER | NestJS PDF Engine / Background Worker |
| PDF Merger | `pdf-merger` | pdf | SERVER | NestJS `pdf-lib` Service |
| AI Humanizer | `ai-humanizer` | ai | AI | NestJS AI Gateway -> OpenAI |
| AI Summarizer | `ai-summarizer` | ai | AI | NestJS AI Gateway -> OpenAI |
