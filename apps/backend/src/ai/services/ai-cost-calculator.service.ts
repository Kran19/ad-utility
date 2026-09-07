import { Injectable } from '@nestjs/common';

@Injectable()
export class AiCostCalculatorService {
  /**
   * Approximate token count (1 token ≈ 4 characters for English text)
   */
  estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Compute estimated cost in USD based on published rates per 1,000,000 tokens
   */
  calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
    const normalizedModel = model.toLowerCase();

    // Rates in USD per 1M tokens: [Input, Output]
    const pricing: Record<string, [number, number]> = {
      'gpt-4o-mini': [0.15, 0.60],
      'gpt-4o': [5.00, 15.00],
      'gpt-3.5-turbo': [0.50, 1.50],
      'mock-ai': [0.0, 0.0],
    };

    const rates = pricing[normalizedModel] || pricing['gpt-4o-mini'];
    const inputCost = (inputTokens / 1_000_000) * rates[0];
    const outputCost = (outputTokens / 1_000_000) * rates[1];

    return parseFloat((inputCost + outputCost).toFixed(6));
  }
}
