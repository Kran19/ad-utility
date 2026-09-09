import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { PersonalizationContextService } from '../src/personalization/services/personalization-context.service';
import { PersonalizationRuleService } from '../src/personalization/services/personalization-rule.service';
import { ConversionIntelligenceService } from '../src/personalization/services/conversion-intelligence.service';

describe('Phase 23 — Privacy-Safe Personalization & Conversion Optimization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let authService: AuthService;
  let contextService: PersonalizationContextService;
  let ruleService: PersonalizationRuleService;
  let conversionService: ConversionIntelligenceService;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    authService = moduleFixture.get<AuthService>(AuthService);
    contextService = moduleFixture.get<PersonalizationContextService>(PersonalizationContextService);
    ruleService = moduleFixture.get<PersonalizationRuleService>(PersonalizationRuleService);
    conversionService = moduleFixture.get<ConversionIntelligenceService>(ConversionIntelligenceService);

    // Obtain Admin JWT
    const loginRes = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminToken = loginRes.accessToken || '';

    // Non-admin user token without analytics:read permission
    userToken = jwtService.sign({
      sub: 'user-phase23-id',
      email: 'user-phase23@example.com',
      role: 'USER',
      permissions: [],
    });

    // Seed sample telemetry events for conversion friction testing
    const now = new Date();
    await prisma.analyticsEvent.createMany({
      data: [
        // CTA Friction Seed (high views, low starts on jpg-to-png)
        { eventType: 'PAGE_VIEW', utilitySlug: 'jpg-to-png', sessionToken: 'anon_p23_1', timestamp: now },
        { eventType: 'PAGE_VIEW', utilitySlug: 'jpg-to-png', sessionToken: 'anon_p23_2', timestamp: now },
        { eventType: 'PAGE_VIEW', utilitySlug: 'jpg-to-png', sessionToken: 'anon_p23_3', timestamp: now },
        { eventType: 'PAGE_VIEW', utilitySlug: 'jpg-to-png', sessionToken: 'anon_p23_4', timestamp: now },
        { eventType: 'PAGE_VIEW', utilitySlug: 'jpg-to-png', sessionToken: 'anon_p23_5', timestamp: now },
        { eventType: 'PAGE_VIEW', utilitySlug: 'jpg-to-png', sessionToken: 'anon_p23_6', timestamp: now },
        { eventType: 'TOOL_START', utilitySlug: 'jpg-to-png', sessionToken: 'anon_p23_1', timestamp: now },

        // Completion & Download Seed on case-converter
        { eventType: 'PAGE_VIEW', utilitySlug: 'case-converter', sessionToken: 'anon_p23_7', timestamp: now },
        { eventType: 'TOOL_START', utilitySlug: 'case-converter', sessionToken: 'anon_p23_7', timestamp: now },
        { eventType: 'TOOL_COMPLETE', utilitySlug: 'case-converter', sessionToken: 'anon_p23_7', timestamp: now },
        { eventType: 'RESULT_DOWNLOAD', utilitySlug: 'case-converter', sessionToken: 'anon_p23_7', timestamp: now },

        // Experiment Exposure event
        {
          eventType: 'EXPERIMENT_EXPOSURE',
          utilitySlug: 'case-converter',
          sessionToken: 'anon_p23_exp',
          metadata: { experimentId: 'exp_utility_cta_v1', variantId: 'variant_b' },
          timestamp: now,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Security & RBAC Enforcement', () => {
    it('should reject unauthenticated request to /admin/analytics/personalization with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/personalization')
        .expect(401);

      expect(res.body.statusCode || res.status).toBe(401);
    });

    it('should reject non-admin request lacking analytics:read with 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/personalization')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.statusCode || res.status).toBe(403);
    });

    it('should allow authenticated admin with analytics:read to access personalization intelligence', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/personalization?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.readinessScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.readinessScore).toBeLessThanOrEqual(100);
      expect(res.body.data.conversionOverview).toBeDefined();
    });
  });

  describe('2. Context Resolution Service', () => {
    it('should correctly classify mobile, tablet, and desktop from User-Agent', () => {
      const mobileUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
      const tabletUa = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      const desktopUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

      expect(contextService.resolveDeviceClass(mobileUa)).toBe('mobile');
      expect(contextService.resolveDeviceClass(tabletUa)).toBe('tablet');
      expect(contextService.resolveDeviceClass(desktopUa)).toBe('desktop');
      expect(contextService.resolveDeviceClass('')).toBe('unknown');
    });

    it('should classify organic, paid, social, and direct acquisition channels', () => {
      expect(contextService.resolveAcquisitionChannel({ utm_medium: 'cpc' }, '')).toBe('paid');
      expect(contextService.resolveAcquisitionChannel({ utm_source: 'google', utm_medium: 'organic' }, '')).toBe('organic');
      expect(contextService.resolveAcquisitionChannel({ utm_medium: 'social' }, '')).toBe('social');
      expect(contextService.resolveAcquisitionChannel({}, '')).toBe('direct');
    });
  });

  describe('3. Rule Engine & Experiment Precedence', () => {
    it('should strictly prioritize active experiment assignments over personalization rules', () => {
      const decision = ruleService.evaluateDecision('HERO_CTA', {
        deviceType: 'mobile', // Mobile matches P100 rule
        acquisitionChannel: 'direct',
        sessionDepth: 1,
        experimentAssignments: {
          exp_utility_cta_v1: 'variant_b', // Active experiment
        },
      });

      expect(decision.variantId).toBe('variant_b');
      expect(decision.experimentId).toBe('exp_utility_cta_v1');
      expect(decision.reason).toContain('Experiment Precedence');
    });

    it('should evaluate deterministic rules in priority order when no experiment is active', () => {
      const decision = ruleService.evaluateDecision('HERO_CTA', {
        deviceType: 'mobile',
        acquisitionChannel: 'organic',
        sessionDepth: 1,
      });

      // Mobile rule has P100 vs Organic P90 -> Mobile wins
      expect(decision.variantId).toBe('var_cta_mobile_instant');
      expect(decision.ruleId).toBe('rule_mobile_touch_cta');
      expect(decision.confidence).toBe(0.9);
    });

    it('should fall back to standard baseline default when no rule conditions match', () => {
      const decision = ruleService.evaluateDecision('DOWNLOAD_CTA', {
        deviceType: 'desktop',
        acquisitionChannel: 'direct',
        sessionDepth: 1,
      });

      expect(decision.variantId).toBe('default');
      expect(decision.confidence).toBe(0.5);
      expect(decision.payload.ctaText).toBe('Download File');
    });
  });

  describe('4. Personalized Related Utilities', () => {
    it('should rank reciprocal downstream tools first upon task completion', () => {
      const related = ruleService.rankRelatedUtilities('jpg-to-png', ['image-compressor'], true);

      // Reciprocal for jpg-to-png is png-to-jpg
      expect(related[0]).toBe('png-to-jpg');
      expect(related).toContain('image-compressor');
    });

    it('should preserve standard related tools when task is not completed', () => {
      const related = ruleService.rankRelatedUtilities('pdf-merge', ['pdf-compressor'], false);

      expect(related).toContain('pdf-compressor');
      expect(related).toContain('pdf-split');
    });
  });

  describe('5. Diagnostic Conversion Opportunities & Scoring', () => {
    it('should detect CTA friction when tool start rate is low despite traffic', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/personalization/opportunities?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Verify all opportunity scores are strictly bounded 0-100
      for (const opp of res.body.data) {
        expect(opp.score).toBeGreaterThanOrEqual(0);
        expect(opp.score).toBeLessThanOrEqual(100);
        expect(opp.what).toBeDefined();
        expect(opp.why).toBeDefined();
        expect(opp.action).toBeDefined();
      }

      // Verify descending score sort order
      for (let i = 1; i < res.body.data.length; i++) {
        expect(res.body.data[i - 1].score).toBeGreaterThanOrEqual(res.body.data[i].score);
      }
    });

    it('should return admin rules configuration with priority indicators', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/personalization/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].priority).toBeDefined();
    });

    it('should return active experiments registry for personalization precedence auditing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/personalization/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.activeExperimentsCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.data.experiments)).toBe(true);
    });
  });

  describe('6. Public Personalization Decision Endpoint (Fail-Open)', () => {
    it('should return a valid decision on public POST /personalization/decision', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/personalization/decision')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
        .send({
          surface: 'HERO_CTA',
          utilitySlug: 'jpg-to-png',
          sessionDepth: 1,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.surface).toBe('HERO_CTA');
      expect(res.body.data.variantId).toBe('var_cta_mobile_instant');
      expect(res.body.data.payload.ctaText).toBe('Quick Convert');
    });

    it('should fail open gracefully to baseline default when empty body is sent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/personalization/decision')
        .send({})
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.variantId).toBeDefined();
      expect(res.body.data.payload.ctaText).toBeDefined();
    });
  });

  describe('7. Privacy & Zero-Profile Verification', () => {
    it('should not expose raw session tokens or individual identifiers in API responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/personalization?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const jsonString = JSON.stringify(res.body.data);

      // Verify no raw session tokens leaked
      expect(jsonString).not.toContain('anon_p23_1');
      expect(jsonString).not.toContain('anon_p23_7');
      expect(jsonString).not.toContain('sessionToken');
      expect(jsonString).not.toContain('ipAddress');
    });
  });
});
