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
import {
  AiGenerateRequestDto,
  AiGenerateResponseDto,
  AiMessage,
  DEFAULT_SUPPORTED_AI_MODELS,
  DEFAULT_AI_MODEL,
  AiProviderHealthDto,
  AiProviderHealthStatus,
} from '@ad-utility/shared';
import { AiRequestStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly providerMode: string;
  private readonly openAiApiKey?: string;
  private readonly defaultModel: string;
  private readonly allowedModels: Set<string>;
  private readonly dailyBudgetUsd: number;
  private readonly requestTimeoutMs: number = 20000;
  private lastErrorTimestamp: string | null = null;
  private lastErrorMessage: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rateLimiter: AiRateLimiterService,
    private readonly costCalculator: AiCostCalculatorService,
  ) {
    this.providerMode = (this.config.get<string>('AI_PROVIDER') || 'mock').toLowerCase().trim();
    this.openAiApiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    this.defaultModel = this.config.get<string>('AI_DEFAULT_MODEL') || DEFAULT_AI_MODEL;
    
    const configuredAllowed = this.config.get<string>('AI_ALLOWED_MODELS');
    if (configuredAllowed) {
      this.allowedModels = new Set(
        configuredAllowed.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean),
      );
    } else {
      this.allowedModels = new Set(
        DEFAULT_SUPPORTED_AI_MODELS.map((m) => m.toLowerCase()),
      );
    }

    const budgetConfig = this.config.get<string>('AI_DAILY_BUDGET_USD');
    this.dailyBudgetUsd = budgetConfig ? parseFloat(budgetConfig) : 5.0;

    this.logger.log(
      `AI Gateway initialized: providerMode=${this.providerMode}, defaultModel=${this.defaultModel}, dailyBudget=$${this.dailyBudgetUsd}`,
    );
  }

  /**
   * Returns current provider mode ('mock' | 'openai')
   */
  getProviderMode(): string {
    return this.providerMode;
  }

  /**
   * Returns daily budget in USD
   */
  getDailyBudgetUsd(): number {
    return this.dailyBudgetUsd;
  }

  /**
   * AI Provider Health Reporting (Phase 25)
   * Evaluates configuration, budget status, and provider readiness without leaking secrets.
   * CONFIGURED: Credentials are present (OpenAI).
   * NOT_CONFIGURED: Credentials missing or provider not configured.
   * HEALTHY: Deterministic mock mode active or live-verified.
   */
  async getProviderHealth(): Promise<AiProviderHealthDto> {
    const isMock = this.providerMode === 'mock';
    const hasKey = Boolean(this.openAiApiKey && this.openAiApiKey.length > 0);

    let status: AiProviderHealthStatus;
    let isConfigured: boolean;

    if (isMock) {
      status = 'HEALTHY';
      isConfigured = true;
    } else if (!hasKey) {
      status = 'NOT_CONFIGURED';
      isConfigured = false;
    } else {
      // Credentials are present; marked CONFIGURED (not HEALTHY until live-verified)
      status = 'CONFIGURED';
      isConfigured = true;
    }

    // Compute today's spending and budget status
    const now = new Date();
    const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    let todaySpendUsd = 0;
    try {
      const dailySpend = await this.prisma.aiRequest.aggregate({
        _sum: { estimatedCostUsd: true },
        where: {
          timestamp: { gte: startOfDayUtc },
          status: AiRequestStatus.SUCCESS,
        },
      });
      todaySpendUsd = parseFloat((dailySpend._sum.estimatedCostUsd || 0).toFixed(4));
    } catch {
      todaySpendUsd = 0;
    }

    const budgetStatus: 'OK' | 'EXCEEDED' = todaySpendUsd >= this.dailyBudgetUsd ? 'EXCEEDED' : 'OK';

    return {
      provider: isMock ? 'mock' : 'openai',
      providerMode: this.providerMode,
      status,
      isConfigured,
      defaultModel: this.defaultModel,
      allowedModels: Array.from(this.allowedModels),
      dailyBudgetUsd: this.dailyBudgetUsd,
      todaySpendUsd,
      budgetStatus,
      requestTimeoutMs: this.requestTimeoutMs,
      rateLimitPerMinute: 15,
      lastErrorTimestamp: this.lastErrorTimestamp,
      lastErrorMessage: this.lastErrorMessage,
    };
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
    const clientIdentifier = dto.sessionId ? `sess_${dto.sessionId}` : (ipHash || 'anonymous_user');

    // 1. Validate Input Prompt
    if (!dto.prompt || typeof dto.prompt !== 'string' || dto.prompt.trim().length === 0) {
      throw new BadRequestException('Prompt is required and cannot be empty');
    }

    if (dto.prompt.length > 50000) {
      throw new BadRequestException('Prompt exceeds maximum limit of 50,000 characters');
    }

    // 2. Validate Model Allowlist
    const requestedModel = (dto.model || this.defaultModel).toLowerCase();
    if (!this.allowedModels.has(requestedModel)) {
      throw new BadRequestException(
        `Model "${dto.model}" is not supported or permitted by governance allowlist.`,
      );
    }
    const selectedModel = requestedModel;

    // 3. Application Rate Limiting Check (15 req/min per identifier)
    const rateLimit = await this.rateLimiter.checkRateLimit(clientIdentifier, 15);
    if (!rateLimit.allowed) {
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

    // 4. Daily Spending Budget Guard Check
    await this.checkDailyBudget(requestId, dto, selectedModel, startTime, ipHash);

    // 5. Dispatch to Real Provider or Mock Engine
    let resultText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let status: AiRequestStatus = AiRequestStatus.SUCCESS;
    let errorMessage: string | undefined;

    try {
      if (this.providerMode === 'openai') {
        // Enforce fail-safe missing API key validation
        if (!this.openAiApiKey || this.openAiApiKey.length === 0) {
          throw new HttpException(
            {
              success: false,
              error: {
                code: 'AI_SERVICE_UNAVAILABLE',
                message: 'AI service is temporarily unavailable due to server configuration.',
              },
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        const openAiResponse = await this.callOpenAiApi(dto, selectedModel);
        resultText = openAiResponse.text;
        inputTokens = openAiResponse.inputTokens;
        outputTokens = openAiResponse.outputTokens;
      } else {
        // Deterministic offline Mock AI Provider
        const mockResponse = this.generateMockResponse(dto, selectedModel);
        resultText = mockResponse.text;
        inputTokens = mockResponse.inputTokens;
        outputTokens = mockResponse.outputTokens;
      }
    } catch (err: any) {
      status = AiRequestStatus.FAILED;
      const rawError = err.message || 'Unknown AI error';
      // Sanitize raw error string to prevent secret or token leakage
      errorMessage = rawError.replace(/sk-[a-zA-Z0-9_\-]+/g, 'sk-***').replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, 'Bearer ***');
      this.lastErrorTimestamp = new Date().toISOString();
      this.lastErrorMessage = errorMessage.substring(0, 200);
      this.logger.error(`AI Gateway execution failed for ${dto.utilitySlug}: ${errorMessage}`);

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

      // Pass through already structured HttpExceptions (e.g. 503, 429, 400)
      if (err instanceof HttpException) {
        throw err;
      }

      // Map upstream errors to safe internal user responses
      if (err.name === 'AbortError' || errorMessage.includes('timeout')) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'AI_TIMEOUT',
              message: 'AI request timed out. Please try again.',
            },
          },
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }

      if (errorMessage.includes('429')) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'AI_PROVIDER_RATE_LIMITED',
              message: 'AI provider is experiencing high load. Please try again in a few seconds.',
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'AI_SERVICE_UNAVAILABLE',
              message: 'AI service is temporarily unavailable.',
            },
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new HttpException(
        {
          success: false,
          error: {
            code: 'AI_EXECUTION_FAILED',
            message: 'AI generation failed. Please try again.',
          },
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const durationMs = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUsd = this.costCalculator.calculateCostUsd(selectedModel, inputTokens, outputTokens);

    // 6. Asynchronously log telemetry to PostgreSQL ai_requests
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
   * Daily Budget Guard: Checks current UTC day spending against daily budget
   */
  private async checkDailyBudget(
    requestId: string,
    dto: AiGenerateRequestDto,
    selectedModel: string,
    startTime: number,
    ipHash?: string,
  ): Promise<void> {
    try {
      const now = new Date();
      const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

      const dailySpend = await this.prisma.aiRequest.aggregate({
        _sum: {
          estimatedCostUsd: true,
        },
        where: {
          timestamp: {
            gte: startOfDayUtc,
          },
          status: AiRequestStatus.SUCCESS,
        },
      });

      const todaySpent = dailySpend._sum.estimatedCostUsd || 0;

      if (todaySpent >= this.dailyBudgetUsd) {
        this.logger.warn(
          `Daily AI budget exceeded: spent=$${todaySpent.toFixed(4)}, budget=$${this.dailyBudgetUsd.toFixed(4)}`,
        );

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
          status: AiRequestStatus.FAILED,
          errorMessage: `Daily AI budget of $${this.dailyBudgetUsd} exceeded`,
          ipHash,
        });

        throw new HttpException(
          {
            success: false,
            error: {
              code: 'AI_BUDGET_EXCEEDED',
              message: 'Daily AI processing limit has been reached. Please try again tomorrow.',
            },
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      // If DB aggregation fails, log warning but do not block service
      this.logger.warn(`Failed to verify daily AI budget: ${err.message}`);
    }
  }

  /**
   * Direct OpenAI Chat Completions API invocation with timeout and input separation
   */
  private async callOpenAiApi(
    dto: AiGenerateRequestDto,
    model: string,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const messages: AiMessage[] = [];

    // System instruction (application-controlled)
    if (dto.systemPrompt) {
      messages.push({ role: 'system', content: dto.systemPrompt });
    }

    // User content (untrusted input)
    if (dto.messages && dto.messages.length > 0) {
      messages.push(...dto.messages);
    } else {
      messages.push({ role: 'user', content: dto.prompt });
    }

    // Output token cap (server-side maximum constraint)
    const maxTokens = Math.max(1, Math.min(4000, dto.maxTokens ?? 1500));
    const temperature = typeof dto.temperature === 'number' ? Math.max(0, Math.min(2, dto.temperature)) : 0.7;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

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
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const sanitizedError = errorText.replace(/sk-[a-zA-Z0-9_\-]+/g, 'sk-***').replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, 'Bearer ***');
        throw new Error(`OpenAI API returned HTTP ${response.status}: ${sanitizedError}`);
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
   * Deterministic Mock AI Provider for offline testing and local development
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
    } else if (dto.utilitySlug === 'ai-humanizer') {
      text = `[Humanized]: ${prompt.replace(/\b(furthermore|moreover|in conclusion|delve|testament)\b/gi, 'also')}`;
    } else if (dto.utilitySlug === 'ai-paraphraser') {
      text = `[Paraphrased]: Restructured phrasing of the source text while preserving full original context: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`;
    } else if (dto.utilitySlug === 'ai-grammar-checker') {
      text = JSON.stringify({
        correctedText: prompt,
        issueCount: 0,
        issues: [],
        overallFeedback: 'No critical grammatical or syntactical errors detected in the text.',
      });
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
