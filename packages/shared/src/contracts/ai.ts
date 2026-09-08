/**
 * Supported AI Models
 */
export type AiModel = 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo' | 'mock-ai';

export const DEFAULT_SUPPORTED_AI_MODELS: readonly AiModel[] = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-3.5-turbo',
  'mock-ai',
] as const;

export const DEFAULT_AI_MODEL: AiModel = 'gpt-4o-mini';

/**
 * AI Provider Types
 */
export type AiProvider = 'openai' | 'mock';

/**
 * Model Pricing Schema (USD per 1,000,000 tokens)
 */
export interface AiModelPricing {
  inputPer1MUsd: number;
  outputPer1MUsd: number;
}

/**
 * Standard Chat / Completion Message
 */
export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * AI Generation Request Payload
 */
export interface AiGenerateRequestDto {
  utilitySlug: string;
  prompt: string;
  systemPrompt?: string;
  messages?: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
}

/**
 * AI Generation Response Payload
 */
export interface AiGenerateResponseDto {
  result: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  requestId: string;
}

/**
 * AI Usage Summary Telemetry DTO
 */
export interface AiUsageSummaryDto {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  successRate: number;
  providerMode?: string;
  dailyBudgetUsd?: number;
  todaySpendUsd?: number;
}
