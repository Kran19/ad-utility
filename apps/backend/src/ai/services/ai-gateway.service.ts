import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRateLimiterService } from './ai-rate-limiter.service';
import { AiCostCalculatorService } from './ai-cost-calculator.service';
import { AiGenerateRequestDto, AiGenerateResponseDto, AiMessage } from '@ad-utility/shared';
import { AiRequestStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly openAiApiKey?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rateLimiter: AiRateLimiterService,
    private readonly costCalculator: AiCostCalculatorService,
  ) {
    this.openAiApiKey = this.config.get<string>('OPENAI_API_KEY');
  }

  /**
   * Centralized AI Generation Execution
   */
  async generateText(
    dto: AiGenerateRequestDto,
    ip?: string,
  ): Promise<AiGenerateResponseDto> {
    const requestId = randomUUID();
    const startTime = Date.now();
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').substring(0, 32) : undefined;
    const clientIdentifier = ipHash || dto.sessionId || 'anonymous_user';

    // 1. Validate Input
    if (!dto.prompt || typeof dto.prompt !== 'string' || dto.prompt.trim().length === 0) {
      throw new BadRequestException('Prompt is required and cannot be empty');
    }

    if (dto.prompt.length > 50000) {
      throw new BadRequestException('Prompt exceeds maximum limit of 50,000 characters');
    }

    // 2. Rate Limiting Check
    const rateLimit = await this.rateLimiter.checkRateLimit(clientIdentifier, 15);
    if (!rateLimit.allowed) {
      await this.logAiRequestTelemetry({
        requestId,
        utilitySlug: dto.utilitySlug || 'unknown',
        model: dto.model || 'gpt-4o-mini',
        promptTemplate: dto.systemPrompt,
        inputTokens: this.costCalculator.estimateTokenCount(dto.prompt),
        outputTokens: 0,
        totalTokens: this.costCalculator.estimateTokenCount(dto.prompt),
        estimatedCostUsd: 0,
        durationMs: Date.now() - startTime,
        status: AiRequestStatus.RATE_LIMITED,
        errorMessage: 'Rate limit exceeded (15 requests/minute)',
        ipHash,
      });

      throw new HttpException(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many AI requests. Please wait a moment before trying again.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const selectedModel = dto.model || 'gpt-4o-mini';
    let resultText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let status: AiRequestStatus = AiRequestStatus.SUCCESS;
    let errorMessage: string | undefined;

    try {
      // 3. Dispatch to OpenAI API or Mock Provider
      if (this.openAiApiKey && this.openAiApiKey.trim().length > 0 && selectedModel !== 'mock-ai') {
        const openAiResponse = await this.callOpenAiApi(dto, selectedModel);
        resultText = openAiResponse.text;
        inputTokens = openAiResponse.inputTokens;
        outputTokens = openAiResponse.outputTokens;
      } else {
        // Fallback Mock AI Engine for offline/test environments
        const mockResponse = this.generateMockResponse(dto, selectedModel);
        resultText = mockResponse.text;
        inputTokens = mockResponse.inputTokens;
        outputTokens = mockResponse.outputTokens;
      }
    } catch (err: any) {
      status = AiRequestStatus.FAILED;
      errorMessage = err.message;
      this.logger.error(`AI Gateway execution failed for ${dto.utilitySlug}: ${err.message}`);

      await this.logAiRequestTelemetry({
        requestId,
        utilitySlug: dto.utilitySlug || 'unknown',
        model: selectedModel,
        promptTemplate: dto.systemPrompt,
        inputTokens: this.costCalculator.estimateTokenCount(dto.prompt),
        outputTokens: 0,
        totalTokens: this.costCalculator.estimateTokenCount(dto.prompt),
        estimatedCostUsd: 0,
        durationMs: Date.now() - startTime,
        status,
        errorMessage,
        ipHash,
      });

      throw new HttpException(
        {
          success: false,
          error: {
            code: 'AI_EXECUTION_FAILED',
            message: `AI generation failed: ${err.message}`,
          },
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const durationMs = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUsd = this.costCalculator.calculateCostUsd(selectedModel, inputTokens, outputTokens);

    // 4. Asynchronously log telemetry to PostgreSQL
    this.logAiRequestTelemetry({
      requestId,
      utilitySlug: dto.utilitySlug || 'unknown',
      model: selectedModel,
      promptTemplate: dto.systemPrompt,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd,
      durationMs,
      status,
      errorMessage,
      ipHash,
    }).catch(() => {
      // non-blocking
    });

    return {
      result: resultText,
      model: selectedModel,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd,
      durationMs,
      requestId,
    };
  }

  /**
   * Direct OpenAI Chat Completions API invocation with timeout
   */
  private async callOpenAiApi(
    dto: AiGenerateRequestDto,
    model: string,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const messages: AiMessage[] = [];

    if (dto.systemPrompt) {
      messages.push({ role: 'system', content: dto.systemPrompt });
    }

    if (dto.messages && dto.messages.length > 0) {
      messages.push(...dto.messages);
    } else {
      messages.push({ role: 'user', content: dto.prompt });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openAiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: dto.temperature ?? 0.7,
          max_tokens: dto.maxTokens ?? 1500,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API returned HTTP ${response.status}: ${errorText}`);
      }

      const json = await response.json();
      const choice = json.choices?.[0];
      const text = choice?.message?.content || '';
      const usage = json.usage || {};

      return {
        text,
        inputTokens: usage.prompt_tokens || this.costCalculator.estimateTokenCount(dto.prompt),
        outputTokens: usage.completion_tokens || this.costCalculator.estimateTokenCount(text),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Deterministic Mock AI Provider for testing and local development
   */
  private generateMockResponse(
    dto: AiGenerateRequestDto,
    model: string,
  ): { text: string; inputTokens: number; outputTokens: number } {
    const prompt = dto.prompt.trim();
    let text = '';

    if (dto.utilitySlug === 'ai-summarizer') {
      const wordCount = prompt.split(/\s+/).length;
      text = `Key Takeaways & Summary:\n• Overview of ${wordCount} words processed accurately.\n• Essential themes and conclusions extracted cleanly.\n• Formatted for quick reading and comprehension.`;
    } else {
      text = `[AI Generated Output (${model})]: Successfully processed input for ${dto.utilitySlug || 'utility'}. Output based on prompt: "${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}"`;
    }

    const inputTokens = this.costCalculator.estimateTokenCount(prompt);
    const outputTokens = this.costCalculator.estimateTokenCount(text);

    return { text, inputTokens, outputTokens };
  }

  /**
   * Usage Telemetry Logger (PostgreSQL ai_requests)
   */
  private async logAiRequestTelemetry(data: {
    requestId: string;
    utilitySlug: string;
    model: string;
    promptTemplate?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    durationMs: number;
    status: AiRequestStatus;
    errorMessage?: string;
    ipHash?: string;
  }): Promise<void> {
    try {
      await this.prisma.aiRequest.create({
        data: {
          requestId: data.requestId,
          utilitySlug: data.utilitySlug,
          model: data.model,
          promptTemplate: data.promptTemplate,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens: data.totalTokens,
          estimatedCostUsd: data.estimatedCostUsd,
          durationMs: data.durationMs,
          status: data.status,
          errorMessage: data.errorMessage,
          ipHash: data.ipHash,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to log AI request telemetry to database: ${err.message}`);
    }
  }
}
