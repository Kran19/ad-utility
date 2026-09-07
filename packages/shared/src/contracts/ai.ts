/**
 * Supported AI Models
 */
export type AiModel = 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo' | 'mock-ai';

/**
 * AI Provider Types
 */
export type AiProvider = 'openai' | 'mock';

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
}
