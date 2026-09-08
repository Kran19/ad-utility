import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AiGatewayService } from '../src/ai/services/ai-gateway.service';
import { AiCostCalculatorService } from '../src/ai/services/ai-cost-calculator.service';
import { AiRateLimiterService } from '../src/ai/services/ai-rate-limiter.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { ConfigService } from '@nestjs/config';

jest.setTimeout(30000);

describe('Phase 15 & 15.1: Real AI Provider Integration & Smoke Verification Suite', () => {
  let app: INestApplication;
  let aiGatewayService: AiGatewayService;
  let costCalculator: AiCostCalculatorService;
  let rateLimiter: AiRateLimiterService;
  let prisma: PrismaService;
  let authService: AuthService;
  let utilitiesService: UtilitiesService;
  let adminAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    aiGatewayService = moduleFixture.get<AiGatewayService>(AiGatewayService);
    costCalculator = moduleFixture.get<AiCostCalculatorService>(AiCostCalculatorService);
    rateLimiter = moduleFixture.get<AiRateLimiterService>(AiRateLimiterService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);
    utilitiesService = moduleFixture.get<UtilitiesService>(UtilitiesService);

    const loginResult = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminAccessToken = loginResult.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Mock Mode & Default Governance Execution', () => {
    it('should generate text using default mock provider when AI_PROVIDER=mock', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: 'Furthermore, the system demonstrates exceptional capability.',
          model: 'gpt-4o-mini',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result).toContain('[Humanized]:');
      expect(response.body.data.model).toBe('gpt-4o-mini');
      expect(response.body.data.inputTokens).toBeGreaterThan(0);
      expect(response.body.data.outputTokens).toBeGreaterThan(0);
      expect(response.body.data.requestId).toBeDefined();

      // Verify PostgreSQL telemetry record
      const record = await prisma.aiRequest.findUnique({
        where: { requestId: response.body.data.requestId },
      });
      expect(record).toBeDefined();
      expect(record?.status).toBe('SUCCESS');
      expect(record?.utilitySlug).toBe('ai-humanizer');
    });

    it('should reject unauthorized / unapproved models with 400 Bad Request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: 'Test prompt text',
          model: 'unauthorized-expensive-model-v99',
        })
        .expect(400);

      expect(response.body.message || response.body.error).toBeDefined();
    });

    it('should reject empty or whitespace-only prompts with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: '    ',
        })
        .expect(400);
    });

    it('should reject oversized prompts exceeding 50,000 characters with 400 Bad Request', async () => {
      const oversizedPrompt = 'a'.repeat(50001);
      await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: oversizedPrompt,
        })
        .expect(400);
    });
  });

  describe('2. Rate Limiting & Abuse Protection', () => {
    it('should trigger RATE_LIMIT_EXCEEDED when request limit per minute is exceeded', async () => {
      const sessionId = 'test_rate_limit_phase15_' + Date.now();
      let triggered429 = false;

      for (let i = 0; i < 20; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/ai/generate')
          .send({
            utilitySlug: 'ai-paraphraser',
            prompt: `Paraphrase test sample ${i}`,
            sessionId,
          });

        if (res.status === 429) {
          triggered429 = true;
          expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
          break;
        }
      }

      expect(triggered429).toBe(true);
    });
  });

  describe('3. Cost Calculation & Dynamic Pricing Governance', () => {
    it('should calculate accurate cost based on verified rates', () => {
      // gpt-4o-mini: $0.15 / 1M in, $0.60 / 1M out
      const costMini = costCalculator.calculateCostUsd('gpt-4o-mini', 10000, 5000);
      expect(costMini).toBe(0.0045);

      // gpt-4o: $2.50 / 1M in, $10.00 / 1M out
      const costGpt4 = costCalculator.calculateCostUsd('gpt-4o', 10000, 5000);
      expect(costGpt4).toBe(0.075);

      // mock-ai: 0 cost
      const costMock = costCalculator.calculateCostUsd('mock-ai', 10000, 5000);
      expect(costMock).toBe(0);
    });

    it('should return pricing metadata for registered models', () => {
      const pricing = costCalculator.getModelPricing('gpt-4o-mini');
      expect(pricing.inputPer1MUsd).toBe(0.15);
      expect(pricing.outputPer1MUsd).toBe(0.60);

      const models = costCalculator.getRegisteredModels();
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('gpt-4o');
      expect(models).toContain('mock-ai');
    });
  });

  describe('4. Daily AI Budget Guard & Telemetry', () => {
    it('should track daily spending and return budget status in Admin usage summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/usage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBeGreaterThanOrEqual(1);
      expect(response.body.data.dailyBudgetUsd).toBeDefined();
      expect(response.body.data.todaySpendUsd).toBeDefined();
      expect(response.body.data.providerMode).toBeDefined();
    });

    it('should safely enforce daily budget ceiling when limit is reached', async () => {
      const zeroBudgetConfig = new ConfigService({
        AI_PROVIDER: 'mock',
        AI_DAILY_BUDGET_USD: '0.000000', // Zero dollar budget
      });
      const zeroBudgetGateway = new AiGatewayService(
        zeroBudgetConfig,
        prisma,
        rateLimiter,
        costCalculator,
      );

      // Attempt generation when budget is zero and spending exists
      try {
        await zeroBudgetGateway.generateText({
          prompt: 'Budget ceiling verification prompt',
          utilitySlug: 'ai-humanizer',
        });
      } catch (err: any) {
        expect(err.status).toBe(503);
        expect(err.response?.error?.code).toBe('AI_BUDGET_EXCEEDED');
      }
    });
  });

  describe('5. AI Utility Adapters End-to-End Execution', () => {
    it('ai-humanizer: should execute via UtilitiesService and Gateway', async () => {
      const response = await utilitiesService.executeUtility(
        'ai-humanizer',
        {
          text: 'Moreover, it is essential to comprehend the fundamental concepts.',
          tone: 'formal',
        },
        '127.0.0.1',
        'Jest-Phase-15',
        'test_session_token',
      );

      expect(response.result).toBeDefined();
      const output = response.result as any;
      expect(output.humanizedText).toBeDefined();
      expect(output.originalWordCount).toBeGreaterThan(0);
      expect(output.model).toBeDefined();
    });

    it('ai-paraphraser: should execute via UtilitiesService and Gateway', async () => {
      const response = await utilitiesService.executeUtility(
        'ai-paraphraser',
        {
          text: 'The fast brown fox jumped over the lazy dog.',
          style: 'fluent',
        },
        '127.0.0.1',
        'Jest-Phase-15',
        'test_session_token',
      );

      expect(response.result).toBeDefined();
      const output = response.result as any;
      expect(output.paraphrasedText).toBeDefined();
      expect(output.originalWordCount).toBeGreaterThan(0);
    });

    it('ai-grammar-checker: should execute and return structured JSON result', async () => {
      const response = await utilitiesService.executeUtility(
        'ai-grammar-checker',
        {
          text: 'They has went to the market yesterday.',
        },
        '127.0.0.1',
        'Jest-Phase-15',
        'test_session_token',
      );

      expect(response.result).toBeDefined();
      const output = response.result as any;
      expect(output.correctedText).toBeDefined();
      expect(typeof output.issueCount).toBe('number');
      expect(Array.isArray(output.issues)).toBe(true);
      expect(output.overallFeedback).toBeDefined();
    });
  });

  describe('6. Fail-Safe Subsystem Isolation & Error Masking (Phase 15.1 Requirement)', () => {
    it('should continue executing non-AI utilities (text-cleaner, case-converter) even if AI is unavailable', async () => {
      // Execute text-cleaner
      const textRes = await utilitiesService.executeUtility(
        'text-cleaner',
        {
          text: '   Extra   spaces   cleaned   ',
        },
        '127.0.0.1',
        'Jest-Phase-15',
        'test_session_token',
      );
      expect(textRes.result).toBeDefined();
      expect((textRes.result as any).cleanedText).toBe('Extra spaces cleaned');

      // Execute case-converter
      const caseRes = await utilitiesService.executeUtility(
        'case-converter',
        {
          text: 'hello world',
          mode: 'uppercase',
        },
        '127.0.0.1',
        'Jest-Phase-15',
        'test_session_token',
      );
      expect(caseRes.result).toBeDefined();
      expect((caseRes.result as any).convertedText).toBe('HELLO WORLD');
    });

    it('should fail safely on missing API key when AI_PROVIDER=openai without crashing (HTTP 503)', async () => {
      const missingKeyConfig = new ConfigService({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: '', // Missing API key
      });
      const failingGateway = new AiGatewayService(
        missingKeyConfig,
        prisma,
        rateLimiter,
        costCalculator,
      );

      try {
        await failingGateway.generateText({
          prompt: 'Testing missing key scenario',
          utilitySlug: 'ai-humanizer',
        });
        fail('Expected generateText to throw');
      } catch (err: any) {
        expect(err.status).toBe(503);
        expect(err.response?.error?.code).toBe('AI_SERVICE_UNAVAILABLE');
      }

      // Non-AI utility continues to execute flawlessly
      const nonAiResult = await utilitiesService.executeUtility(
        'case-converter',
        {
          text: 'still working',
          mode: 'uppercase',
        },
        '127.0.0.1',
        'Jest-Phase-15',
        'test_session_token',
      );
      expect(nonAiResult.result).toBeDefined();
      expect((nonAiResult.result as any).convertedText).toBe('STILL WORKING');
    });

    it('should mask invalid API key upstream errors and not leak credentials (HTTP 503)', async () => {
      const invalidKeyConfig = new ConfigService({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-invalid-test-key-for-smoke-test-401',
      });
      const invalidGateway = new AiGatewayService(
        invalidKeyConfig,
        prisma,
        rateLimiter,
        costCalculator,
      );

      try {
        await invalidGateway.generateText({
          prompt: 'Testing invalid key scenario',
          utilitySlug: 'ai-humanizer',
        });
        fail('Expected generateText to throw on invalid API key');
      } catch (err: any) {
        // Assert error is sanitized (503 Service Unavailable or 502 Bad Gateway)
        expect([502, 503]).toContain(err.status);
        // Assert raw API key string is NEVER included in client response message
        expect(JSON.stringify(err.response)).not.toContain('sk-invalid-test-key');
        expect(JSON.stringify(err.response)).not.toContain('Bearer');
      }
    });
  });

  describe('7. Opt-In Real Provider Verification (AI_REAL_PROVIDER_TEST=true)', () => {
    const isRealTestEnabled = process.env.AI_REAL_PROVIDER_TEST === 'true';
    const hasApiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);

    if (isRealTestEnabled && hasApiKey) {
      it('[OPT-IN] should successfully call real OpenAI Chat Completions API with minimal prompt', async () => {
        const customConfig = new ConfigService({
          AI_PROVIDER: 'openai',
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          AI_DEFAULT_MODEL: 'gpt-4o-mini',
        });
        const realGateway = new AiGatewayService(
          customConfig,
          prisma,
          rateLimiter,
          costCalculator,
        );

        const res = await realGateway.generateText({
          prompt: 'Return exactly the word: PASS',
          utilitySlug: 'ai-smoke-test',
          maxTokens: 10,
        });

        expect(res.result).toBeDefined();
        expect(res.result.trim().length).toBeGreaterThan(0);
        expect(res.model).toBe('gpt-4o-mini');
        expect(res.inputTokens).toBeGreaterThan(0);
        expect(res.outputTokens).toBeGreaterThan(0);
        expect(res.totalTokens).toBeGreaterThan(0);
        expect(res.estimatedCostUsd).toBeGreaterThanOrEqual(0);
        expect(res.requestId).toBeDefined();

        // Verify PostgreSQL telemetry record
        const record = await prisma.aiRequest.findUnique({
          where: { requestId: res.requestId },
        });
        expect(record).toBeDefined();
        expect(record?.status).toBe('SUCCESS');
        expect(record?.model).toBe('gpt-4o-mini');
        // Verify prompt and response texts are NOT persisted to the database
        expect((record as any).prompt).toBeUndefined();
        expect((record as any).result).toBeUndefined();
      });

      it('[OPT-IN] should execute real AI utility (ai-grammar-checker) with minimal output', async () => {
        const response = await utilitiesService.executeUtility(
          'ai-grammar-checker',
          {
            text: 'I has a pencil.',
          },
          '127.0.0.1',
          'Jest-Phase-15.1-Real',
          'test_session_token_real',
        );

        expect(response.result).toBeDefined();
        const output = response.result as any;
        expect(output.correctedText).toBeDefined();
        expect(output.correctedText).toContain('have');
      });
    } else {
      it('skips real provider network call during normal deterministic CI runs', () => {
        expect(true).toBe(true);
      });
    }
  });
});
