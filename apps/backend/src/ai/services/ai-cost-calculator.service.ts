import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModelPricing } from '@ad-utility/shared';

@Injectable()
export class AiCostCalculatorService {
  private readonly logger = new Logger(AiCostCalculatorService.name);
  private readonly pricingTable: Map<string, AiModelPricing> = new Map();

  constructor(@Optional() private readonly config?: ConfigService) {
    this.initializePricing();
  }

  /**
   * Initializes pricing with official baseline rates and applies configuration overrides if present.
   */
  private initializePricing(): void {
    // Verified official baseline rates in USD per 1M tokens: [Input, Output]
    const defaultPricing: Record<string, AiModelPricing> = {
      'gpt-4o-mini': { inputPer1MUsd: 0.15, outputPer1MUsd: 0.60 },
      'gpt-4o': { inputPer1MUsd: 2.50, outputPer1MUsd: 10.00 },
      'gpt-3.5-turbo': { inputPer1MUsd: 0.50, outputPer1MUsd: 1.50 },
      'mock-ai': { inputPer1MUsd: 0.0, outputPer1MUsd: 0.0 },
    };

    for (const [model, rates] of Object.entries(defaultPricing)) {
      this.pricingTable.set(model.toLowerCase(), rates);
    }

    // Check for dynamic pricing overrides via environment variable (JSON string)
    const rawOverrides = this.config?.get<string>('AI_PRICING_OVERRIDES_JSON');
    if (rawOverrides) {
      try {
        const parsed = JSON.parse(rawOverrides);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [model, rates] of Object.entries(parsed)) {
            const pricing = rates as any;
            if (
              typeof pricing?.inputPer1MUsd === 'number' &&
              typeof pricing?.outputPer1MUsd === 'number'
            ) {
              this.pricingTable.set(model.toLowerCase(), {
                inputPer1MUsd: pricing.inputPer1MUsd,
                outputPer1MUsd: pricing.outputPer1MUsd,
              });
              this.logger.log(`Applied pricing override for model: ${model}`);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to parse AI_PRICING_OVERRIDES_JSON: ${err.message}`);
      }
    }
  }

  /**
   * Approximate token count (1 token ≈ 4 characters for standard English text)
   */
  estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Compute estimated cost in USD based on configured rates per 1,000,000 tokens
   */
  calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
    const normalizedModel = (model || 'gpt-4o-mini').toLowerCase();
    const pricing = this.pricingTable.get(normalizedModel) || this.pricingTable.get('gpt-4o-mini')!;

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1MUsd;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1MUsd;

    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Get pricing details for a given model
   */
  getModelPricing(model: string): AiModelPricing {
    const normalizedModel = (model || 'gpt-4o-mini').toLowerCase();
    return this.pricingTable.get(normalizedModel) || this.pricingTable.get('gpt-4o-mini')!;
  }

  /**
   * Get all registered models with pricing
   */
  getRegisteredModels(): string[] {
    return Array.from(this.pricingTable.keys());
  }
}
