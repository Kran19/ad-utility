import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AiGatewayService } from '../src/ai/services/ai-gateway.service';
import { AiCostCalculatorService } from '../src/ai/services/ai-cost-calculator.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

jest.setTimeout(30000);

describe('Phase 6: Centralized AI Gateway & Model Governance Verification', () => {
  let app: INestApplication;
  let aiGatewayService: AiGatewayService;
  let costCalculator: AiCostCalculatorService;
  let prisma: PrismaService;
  let authService: AuthService;
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
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // Login as Super Admin to get token for admin endpoints
    const loginResult = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminAccessToken = loginResult.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Text Generation & Telemetry Logging', () => {
    it('should generate text response and calculate tokens & cost', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-summarizer',
          prompt: 'This is a long test article about software architecture and centralized AI gateways.',
          model: 'gpt-4o-mini',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result).toBeDefined();
      expect(response.body.data.inputTokens).toBeGreaterThan(0);
      expect(response.body.data.outputTokens).toBeGreaterThan(0);
      expect(response.body.data.totalTokens).toBeGreaterThan(0);
      expect(response.body.data.requestId).toBeDefined();

      // Check PostgreSQL persistence in ai_requests
      const recorded = await prisma.aiRequest.findUnique({
        where: { requestId: response.body.data.requestId },
      });
      expect(recorded).toBeDefined();
      expect(recorded?.utilitySlug).toBe('ai-summarizer');
      expect(recorded?.status).toBe('SUCCESS');
    });

    it('should reject empty prompts with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ai/generate')
        .send({
          utilitySlug: 'ai-summarizer',
          prompt: '   ',
        })
        .expect(400);
    });
  });

  describe('2. Cost Calculation Engine', () => {
    it('should calculate accurate costs per 1M tokens across models', () => {
      // 10,000 input tokens, 2,000 output tokens on gpt-4o-mini ($0.15/$0.60 per 1M)
      const costMini = costCalculator.calculateCostUsd('gpt-4o-mini', 10000, 2000);
      expect(costMini).toBe(0.0027);

      // 10,000 input tokens, 2,000 output tokens on gpt-4o ($2.50/$10.00 per 1M)
      const costGpt4 = costCalculator.calculateCostUsd('gpt-4o', 10000, 2000);
      expect(costGpt4).toBe(0.045);

      // mock-ai is free
      const costMock = costCalculator.calculateCostUsd('mock-ai', 10000, 2000);
      expect(costMock).toBe(0);
    });
  });

  describe('3. Rate Limiting Protection', () => {
    it('should reject rapid requests when rate limit threshold is reached', async () => {
      const sessionId = 'test_rate_limited_session';
      let triggered429 = false;

      // Send 20 requests rapidly
      for (let i = 0; i < 20; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/ai/generate')
          .send({
            utilitySlug: 'ai-summarizer',
            prompt: `Rate limit test prompt ${i}`,
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

  describe('4. Admin Telemetry Endpoint', () => {
    it('GET /api/v1/ai/usage - should require authentication (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/ai/usage')
        .expect(401);
    });

    it('GET /api/v1/ai/usage - should return aggregate telemetry summary for Admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/usage')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBeGreaterThanOrEqual(1);
      expect(response.body.data.totalTokens).toBeGreaterThanOrEqual(1);
      expect(response.body.data.successRate).toBeDefined();
    });
  });
});
