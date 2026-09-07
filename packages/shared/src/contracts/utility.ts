/**
 * Execution Mode for Utilities
 */
export type UtilityExecutionMode = 'LOCAL' | 'SERVER' | 'AI';

/**
 * Publication/Lifecycle Status
 */
export type UtilityStatus = 'ACTIVE' | 'DRAFT' | 'DISABLED';

/**
 * FAQ Item Structure for SEO and user documentation
 */
export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Enforceable Resource Limits per Utility
 */
export interface UtilityResourceLimits {
  /** Max input size in bytes (e.g. 5MB for text, 20MB for images) */
  maxInputSizeBytes?: number;
  /** Max wall-clock execution time in milliseconds before timeout */
  maxExecutionTimeMs?: number;
  /** Max single file size in bytes */
  maxFileSizeBytes?: number;
  /** Allowed MIME types for file-based processing */
  allowedMimeTypes?: string[];
  /** Max batch count for multiple item processing */
  maxBatchCount?: number;
}

/**
 * Standardized Context passed to Utility Adapter execute method
 */
export interface UtilityExecutionContext {
  requestId: string;
  utilitySlug: string;
  executionMode: UtilityExecutionMode;
  ip?: string;
  userAgent?: string;
  sessionToken?: string;
  locale?: string;
  limits?: UtilityResourceLimits;
  signal?: AbortSignal;
}

/**
 * Standard Utility Error Codes
 */
export type UtilityErrorCode =
  | 'UTILITY_NOT_FOUND'
  | 'UTILITY_DISABLED'
  | 'ADAPTER_MISSING'
  | 'INVALID_INPUT'
  | 'OUTPUT_VALIDATION_FAILED'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'EXECUTION_TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'UNSUPPORTED_OPERATION';

/**
 * Standard Utility Error Payload
 */
export interface UtilityErrorPayload {
  code: UtilityErrorCode;
  message: string;
  details?: Record<string, any>;
  requestId?: string;
}

/**
 * Canonical Utility Adapter Interface (Code-First)
 */
export interface UtilityAdapter<TInput = any, TOutput = any> {
  /** Unique stable slug identifier (e.g. 'json-formatter', 'jpg-to-png') */
  readonly slug: string;
  /** Human-readable tool name */
  readonly name: string;
  /** Brief functional description */
  readonly description: string;
  /** Semantic version of the code adapter */
  readonly version: string;
  /** Execution mode: LOCAL (browser), SERVER (NestJS backend), or AI (gateway) */
  readonly mode: UtilityExecutionMode;
  /** Optional resource limits */
  readonly resourceLimits?: UtilityResourceLimits;

  /**
   * Validates and sanitizes raw input. Throws an error or returns typed TInput.
   */
  validateInput(input: unknown): TInput;

  /**
   * Optional output validator ensuring result correctness before responding.
   */
  validateOutput?(output: unknown): TOutput;

  /**
   * Primary execution method. Must be deterministic and isolated.
   */
  execute(input: TInput, context: UtilityExecutionContext): Promise<TOutput> | TOutput;
}

/**
 * Public Utility Metadata DTO returned to frontend clients
 */
export interface UtilityPublicDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  implementationMode: UtilityExecutionMode;
  status: UtilityStatus;
  isFeatured: boolean;
  displayOrder: number;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl?: string | null;
  faqContent: FAQItem[];
  relatedSlugs: string[];
  config?: Record<string, any>;
  version: string;
  isAdapterAvailable: boolean;
}

/**
 * Utility Execution Request Payload
 */
export interface UtilityExecutionRequestDto<TInput = any> {
  input: TInput;
  configOverride?: Record<string, any>;
}

/**
 * Utility Execution Response Payload
 */
export interface UtilityExecutionResponseDto<TOutput = any> {
  result: TOutput;
  executionTimeMs: number;
  mode: UtilityExecutionMode;
  requestId: string;
}
