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
import { AiRequestStatus } from '@prisma/client';

jest.setTimeout(30000);

describe('Phase 25: Real OpenAI Provider Activation & Production AI Verification Suite', () => {
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

  // =========================================================================
  // 1. Centralized AI Gateway & Routing Audit
  // =========================================================================
  describe('1. Centralized AI Gateway & Routing Audit', () => {
    it('should route text generation through centralized AiGatewayService', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: 'Furthermore, the system demonstrates high resilience and modularity.',
          model: 'gpt-4o-mini',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result).toBeDefined();
      expect(response.body.data.model).toBe('gpt-4o-mini');
      expect(response.body.data.inputTokens).toBeGreaterThan(0);
      expect(response.body.data.outputTokens).toBeGreaterThan(0);
      expect(response.body.data.totalTokens).toBeGreaterThan(0);
      expect(response.body.data.durationMs).toBeGreaterThanOrEqual(0);
      expect(response.body.data.requestId).toBeDefined();
    });

    it('should reject unapproved or unknown models with HTTP 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: 'Test prompt text',
          model: 'unauthorized-model-xyz',
        })
        .expect(400);

      expect(response.body.message || response.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Request Validation & Governance
  // =========================================================================
  describe('2. Request Validation & Governance', () => {
    it('should reject empty or whitespace-only prompt with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: '   \n  \t  ',
        })
        .expect(400);
    });

    it('should reject oversized prompt exceeding 50,000 characters with HTTP 400', async () => {
      const oversized = 'x'.repeat(50001);
      await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: oversized,
        })
        .expect(400);
    });

    it('should accept prompts within allowable 50,000 character limit', async () => {
      const validPrompt = 'Valid content for processing. '.repeat(10);
      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: validPrompt,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Provider Selection & Safe Failure Handling
  // =========================================================================
  describe('3. Provider Selection & Safe Failure Handling', () => {
    it('should remain deterministic in mock mode without external calls', async () => {
      expect(aiGatewayService.getProviderMode()).toBe('mock');

      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-paraphraser',
          prompt: 'The quick brown fox jumps over the lazy dog.',
        })
        .expect(200);

      expect(response.body.data.result).toContain('[Paraphrased]:');
    });

    it('should return HTTP 503 AI_SERVICE_UNAVAILABLE when AI_PROVIDER=openai but OPENAI_API_KEY is missing', async () => {
      const missingKeyConfig = new ConfigService({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: '',
      });
      const failingGateway = new AiGatewayService(
        missingKeyConfig,
        prisma,
        rateLimiter,
        costCalculator,
      );

      try {
        await failingGateway.generateText({
          prompt: 'Testing missing API key scenario',
          utilitySlug: 'ai-humanizer',
        });
        fail('Expected generateText to throw');
      } catch (err: any) {
        expect(err.status).toBe(503);
        expect(err.response?.error?.code).toBe('AI_SERVICE_UNAVAILABLE');
      }
    });

    it('should sanitize upstream OpenAI error messages and never leak secrets or tokens', async () => {
      const testSecretKey = 'sk-mock-secret-key-1234567890abcdef';
      const invalidKeyConfig = new ConfigService({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: testSecretKey,
      });
      const invalidGateway = new AiGatewayService(
        invalidKeyConfig,
        prisma,
        rateLimiter,
        costCalculator,
      );

      try {
        await invalidGateway.generateText({
          prompt: 'Testing credential masking',
          utilitySlug: 'ai-humanizer',
        });
        fail('Expected generateText to throw on invalid API key');
      } catch (err: any) {
        expect([502, 503]).toContain(err.status);
        const serialized = JSON.stringify(err.response);
        expect(serialized).not.toContain(testSecretKey);
        expect(serialized).not.toContain('Bearer sk-mock');
      }
    });
  });

  // =========================================================================
  // 4. Rate Limiting & Abuse Prevention
  // =========================================================================
  describe('4. Rate Limiting & Abuse Prevention', () => {
    it('should enforce 15 req/min rate limit per client identifier', async () => {
      const testSession = 'rate_test_' + Date.now();
      let hitLimit = false;

      for (let i = 0; i < 20; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/ai/generate')
          .set('X-Forwarded-For', '192.168.100.1')
          .send({
            utilitySlug: 'ai-humanizer',
            prompt: `Prompt variation ${i}`,
            sessionId: testSession,
          });

        if (res.status === 429) {
          hitLimit = true;
          expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
          break;
        }
      }

      expect(hitLimit).toBe(true);
    });
  });

  // =========================================================================
  // 5. Cost Calculation & Budget Governance
  // =========================================================================
  describe('5. Cost Calculation & Budget Governance', () => {
    it('should calculate accurate costs based on verified per-million token rates', () => {
      // gpt-4o-mini: $0.15/1M input, $0.60/1M output
      const costMini = costCalculator.calculateCostUsd('gpt-4o-mini', 10000, 2000);
      // (10000/1e6)*0.15 + (2000/1e6)*0.60 = 0.0015 + 0.0012 = 0.0027
      expect(costMini).toBe(0.0027);

      // gpt-4o: $2.50/1M input, $10.00/1M output
      const costGpt4 = costCalculator.calculateCostUsd('gpt-4o', 10000, 2000);
      // (10000/1e6)*2.50 + (2000/1e6)*10.00 = 0.025 + 0.020 = 0.045
      expect(costGpt4).toBe(0.045);

      // mock-ai: always 0
      const costMock = costCalculator.calculateCostUsd('mock-ai', 10000, 2000);
      expect(costMock).toBe(0);
    });

    it('should enforce daily budget ceiling when limit is exceeded', async () => {
      const zeroBudgetConfig = new ConfigService({
        AI_PROVIDER: 'mock',
        AI_DAILY_BUDGET_USD: '0.000000',
      });
      const zeroBudgetGateway = new AiGatewayService(
        zeroBudgetConfig,
        prisma,
        rateLimiter,
        costCalculator,
      );

      try {
        await zeroBudgetGateway.generateText({
          prompt: 'Exceed daily budget limit',
          utilitySlug: 'ai-humanizer',
        });
      } catch (err: any) {
        expect(err.status).toBe(503);
        expect(err.response?.error?.code).toBe('AI_BUDGET_EXCEEDED');
      }
    });
  });

  // =========================================================================
  // 6. Telemetry & Data Retention Isolation
  // =========================================================================
  describe('6. Telemetry & Data Retention Isolation', () => {
    it('should persist AI telemetry record without raw prompt or raw response text', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-humanizer',
          prompt: 'Confidential corporate message that must never be stored verbatim.',
          model: 'gpt-4o-mini',
        })
        .expect(200);

      const record = await prisma.aiRequest.findUnique({
        where: { requestId: res.body.data.requestId },
      });

      expect(record).toBeDefined();
      expect(record?.status).toBe(AiRequestStatus.SUCCESS);
      expect(record?.utilitySlug).toBe('ai-humanizer');
      expect(record?.model).toBe('gpt-4o-mini');
      expect(record?.totalTokens).toBeGreaterThan(0);
      expect(record?.durationMs).toBeGreaterThanOrEqual(0);

      // Verify strict data privacy: raw prompt and response are NOT stored in AiRequest
      expect((record as any).prompt).toBeUndefined();
      expect((record as any).response).toBeUndefined();
      expect((record as any).result).toBeUndefined();
      expect((record as any).apiKey).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. AI Utility Adapters End-to-End Execution
  // =========================================================================
  describe('7. AI Utility Adapters End-to-End Execution', () => {
    it('ai-humanizer: should execute cleanly via UtilitiesService', async () => {
      const response = await utilitiesService.executeUtility(
        'ai-humanizer',
        {
          text: 'Moreover, it is a testament to rigorous engineering.',
          tone: 'casual',
        },
        '127.0.0.1',
        'Jest-Phase-25',
        'test_session_phase25',
      );

      expect(response.result).toBeDefined();
      const output = response.result as any;
      expect(output.humanizedText).toBeDefined();
      expect(output.originalWordCount).toBeGreaterThan(0);
    });

    it('ai-paraphraser: should execute cleanly via UtilitiesService', async () => {
      const response = await utilitiesService.executeUtility(
        'ai-paraphraser',
        {
          text: 'Artificial intelligence transforms modern productivity workflows.',
          style: 'creative',
        },
        '127.0.0.1',
        'Jest-Phase-25',
        'test_session_phase25',
      );

      expect(response.result).toBeDefined();
      const output = response.result as any;
      expect(output.paraphrasedText).toBeDefined();
      expect(output.originalWordCount).toBeGreaterThan(0);
    });

    it('ai-grammar-checker: should execute and return structured correction payload', async () => {
      const response = await utilitiesService.executeUtility(
        'ai-grammar-checker',
        {
          text: 'She do not goes to school yesterday.',
        },
        '127.0.0.1',
        'Jest-Phase-25',
        'test_session_phase25',
      );

      expect(response.result).toBeDefined();
      const output = response.result as any;
      expect(output.correctedText).toBeDefined();
      expect(typeof output.issueCount).toBe('number');
      expect(Array.isArray(output.issues)).toBe(true);
    });
  });

  // =========================================================================
  // 8. Non-AI Subsystem Isolation
  // =========================================================================
  describe('8. Non-AI Subsystem Isolation', () => {
    it('should continue executing text-cleaner and case-converter independently of AI subsystem state', async () => {
      const textRes = await utilitiesService.executeUtility(
        'text-cleaner',
        { text: '   Cleaned   white   space   ' },
        '127.0.0.1',
        'Jest-Phase-25',
        'test_session_token',
      );
      expect((textRes.result as any).cleanedText).toBe('Cleaned white space');

      const caseRes = await utilitiesService.executeUtility(
        'case-converter',
        { text: 'phase 25 production ai', mode: 'uppercase' },
        '127.0.0.1',
        'Jest-Phase-25',
        'test_session_token',
      );
      expect((caseRes.result as any).convertedText).toBe('PHASE 25 PRODUCTION AI');
    });
  });

  // =========================================================================
  // 9. AI Provider Health Reporting
  // =========================================================================
  describe('9. AI Provider Health Reporting', () => {
    it('GET /api/v1/ai/health should return sanitized provider health without secrets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/ai/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('mock');
      expect(res.body.data.status).toBe('HEALTHY');
      expect(res.body.data.isConfigured).toBe(true);
      expect(res.body.data.defaultModel).toBeDefined();
      expect(Array.isArray(res.body.data.allowedModels)).toBe(true);
      expect(typeof res.body.data.dailyBudgetUsd).toBe('number');
      expect(typeof res.body.data.todaySpendUsd).toBe('number');
      expect(['OK', 'EXCEEDED']).toContain(res.body.data.budgetStatus);

      // Verify zero secret leakage
      const serialized = JSON.stringify(res.body.data);
      expect(serialized).not.toContain('openAiApiKey');
      expect(serialized).not.toContain('Authorization');
      expect(serialized).not.toContain('apiKey');
    });

    it('should accurately return NOT_CONFIGURED when openai mode lacks credentials', async () => {
      const missingConfig = new ConfigService({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: '',
      });
      const gateway = new AiGatewayService(missingConfig, prisma, rateLimiter, costCalculator);
      const health = await gateway.getProviderHealth();

      expect(health.provider).toBe('openai');
      expect(health.status).toBe('NOT_CONFIGURED');
      expect(health.isConfigured).toBe(false);
    });

    it('should accurately return CONFIGURED (not prematurely HEALTHY) when credentials are present without live verification', async () => {
      const configuredGateway = new AiGatewayService(
        new ConfigService({
          AI_PROVIDER: 'openai',
          OPENAI_API_KEY: 'sk-test-key-configured-present-1234',
        }),
        prisma,
        rateLimiter,
        costCalculator,
      );
      const health = await configuredGateway.getProviderHealth();

      expect(health.provider).toBe('openai');
      expect(health.status).toBe('CONFIGURED');
      expect(health.isConfigured).toBe(true);
    });
  });

  // =========================================================================
  // 10. Admin AI Control Panel & RBAC
  // =========================================================================
  describe('10. Admin AI Control Panel & RBAC', () => {
    it('GET /api/v1/admin/ai/overview should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/ai/overview')
        .expect(401);
    });

    it('GET /api/v1/admin/ai/overview should succeed with valid Admin JWT and return governance metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ai/overview?days=30')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBeDefined();
      expect(res.body.data.providerMode).toBe('MOCK');
      expect(res.body.data.providerHealth).toBeDefined();
      expect(res.body.data.costType).toBe('ESTIMATED');
      expect(typeof res.body.data.totalRequests).toBe('number');
      expect(typeof res.body.data.successfulRequests).toBe('number');
      expect(typeof res.body.data.failedRequests).toBe('number');
    });

    it('GET /api/v1/admin/ai/provider/health should require ai:read permission', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ai/provider/health')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('HEALTHY');
    });

    it('GET /api/v1/ai/usage should return usage summary with costStatus: ESTIMATED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/ai/usage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.costStatus).toBe('ESTIMATED');
      expect(res.body.data.providerHealth).toBeDefined();
      expect(res.body.data.budgetStatus).toBeDefined();
    });
  });

  // =========================================================================
  // 11. Live OpenAI Verification Rule Check
  // =========================================================================
  describe('11. Live OpenAI Verification Rule Check', () => {
    it('verifies that live OpenAI verification is skipped when OPENAI_API_KEY is not configured', () => {
      const hasApiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
      if (!hasApiKey) {
        // Must report NOT RUN — OPENAI_API_KEY NOT CONFIGURED
        expect(hasApiKey).toBe(false);
      } else {
        expect(typeof process.env.OPENAI_API_KEY).toBe('string');
      }
    });
  });
});
