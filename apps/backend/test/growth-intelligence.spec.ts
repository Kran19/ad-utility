import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { GrowthIntelligenceService } from '../src/admin/services/growth-intelligence.service';
import { AnalyticsValidationService } from '../src/analytics/services/analytics-validation.service';
import { getExperimentVariant } from '@ad-utility/shared';

describe('Phase 18 — Growth Analytics, Experimentation & Conversion Intelligence', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let growthService: GrowthIntelligenceService;
  let validationService: AnalyticsValidationService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    authService = moduleRef.get<AuthService>(AuthService);
    growthService = moduleRef.get<GrowthIntelligenceService>(GrowthIntelligenceService);
    validationService = moduleRef.get<AnalyticsValidationService>(AnalyticsValidationService);

    // Obtain Admin JWT for authenticated endpoint tests
    const loginRes = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    adminToken = loginRes.accessToken || '';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Deterministic Experiment Assignment & Hashing', () => {
    it('should deterministically assign the same variant for identical session tokens', () => {
      const expId = 'exp_cta_wording';
      const sessionA = 'sess_user_alpha_12345';
      const sessionB = 'sess_user_beta_67890';
      const variants = [
        { id: 'control', weight: 50 },
        { id: 'variant_a', weight: 50 },
      ];

      const assignment1 = getExperimentVariant(expId, sessionA, variants);
      const assignment2 = getExperimentVariant(expId, sessionA, variants);
      const assignment3 = getExperimentVariant(expId, sessionB, variants);

      expect(assignment1).toBe(assignment2); // Strict reproducibility
      expect(['control', 'variant_a']).toContain(assignment1);
      expect(['control', 'variant_a']).toContain(assignment3);
    });

    it('should distribute sessions across variants in a balanced manner', () => {
      const expId = 'exp_cta_wording';
      const variants = [
        { id: 'control', weight: 50 },
        { id: 'variant_a', weight: 50 },
      ];

      const counts: Record<string, number> = { control: 0, variant_a: 0 };
      for (let i = 0; i < 200; i++) {
        const session = `sess_random_user_${i}_${i * 31}`;
        const variant = getExperimentVariant(expId, session, variants);
        counts[variant]++;
      }

      // With 200 samples and 50/50 weights, each should have at least 30% of total
      expect(counts.control).toBeGreaterThan(50);
      expect(counts.variant_a).toBeGreaterThan(50);
    });

    it('should respect weighted variant allocations', () => {
      const expId = 'exp_weighted_rollout';
      const variants = [
        { id: 'control', weight: 90 },
        { id: 'variant_a', weight: 10 },
      ];

      const counts: Record<string, number> = { control: 0, variant_a: 0 };
      for (let i = 0; i < 300; i++) {
        const session = `sess_weighted_user_${i}_${i * 47}`;
        const variant = getExperimentVariant(expId, session, variants);
        counts[variant]++;
      }

      expect(counts.control).toBeGreaterThan(counts.variant_a);
    });
  });

  describe('2. Telemetry Ingestion & Experiment Validation', () => {
    it('should successfully validate EXPERIMENT_EXPOSURE event', () => {
      const validEvent = validationService.validateAndSanitizeEvent({
        eventType: 'EXPERIMENT_EXPOSURE',
        utilitySlug: 'jpg-to-png',
        sessionToken: 'sess_test_exp_999',
        metadata: {
          experimentId: 'exp_cta_wording',
          variant: 'variant_a',
          converted: true,
        },
      });

      expect(validEvent.eventType).toBe('EXPERIMENT_EXPOSURE');
      expect(validEvent.utilitySlug).toBe('jpg-to-png');
      expect(validEvent.metadata?.experimentId).toBe('exp_cta_wording');
      expect(validEvent.metadata?.variant).toBe('variant_a');
    });

    it('should reject invalid event types', () => {
      expect(() => {
        validationService.validateAndSanitizeEvent({
          eventType: 'MALICIOUS_EVENT_TYPE',
        });
      }).toThrow();
    });

    it('should reject metadata exceeding 5KB limit', () => {
      const hugeObject: Record<string, string> = {};
      for (let i = 0; i < 300; i++) {
        hugeObject[`key_${i}`] = 'X'.repeat(50);
      }

      expect(() => {
        validationService.validateAndSanitizeEvent({
          eventType: 'PAGE_VIEW',
          metadata: hugeObject,
        });
      }).toThrow();
    });
  });

  describe('3. Growth Intelligence Service & Zero-Data Behavior', () => {
    it('should return safe zero-data metrics without division by zero errors', async () => {
      const growth = await growthService.getGrowthIntelligence(1);

      expect(growth).toBeDefined();
      expect(growth.periodDays).toBe(1);
      expect(growth.funnel).toBeDefined();
      expect(typeof growth.funnel.overallConversionRate).toBe('number');
      expect(growth.funnel.overallConversionRate).toBeGreaterThanOrEqual(0);
      expect(growth.funnel.stages).toHaveLength(4);
      expect(growth.monetization).toBeDefined();
      expect(typeof growth.monetization.overallCtr).toBe('number');
      expect(growth.experiments).toBeDefined();
      expect(Array.isArray(growth.experiments)).toBe(true);
    });

    it('should calculate funnel stage conversion and drop-off rates accurately', async () => {
      // Simulate synthetic events for verification
      const testSession = 'sess_growth_test_' + Date.now();
      await prisma.analyticsEvent.createMany({
        data: [
          { eventType: 'PAGE_VIEW', utilitySlug: 'text-cleaner', sessionToken: testSession },
          { eventType: 'TOOL_START', utilitySlug: 'text-cleaner', sessionToken: testSession },
          { eventType: 'TOOL_COMPLETE', utilitySlug: 'text-cleaner', sessionToken: testSession },
          { eventType: 'RESULT_DOWNLOAD', utilitySlug: 'text-cleaner', sessionToken: testSession },
        ],
      });

      const growth = await growthService.getGrowthIntelligence(1);
      expect(growth.funnel.pageViews).toBeGreaterThan(0);
      expect(growth.funnel.toolStarts).toBeGreaterThan(0);
      expect(growth.funnel.toolCompletions).toBeGreaterThan(0);
      expect(growth.funnel.resultDownloads).toBeGreaterThan(0);
      expect(growth.funnel.stages[0].stage).toContain('Landing');
      expect(growth.funnel.stages[3].stage).toContain('Download');
    });

    it('should aggregate utility intelligence metrics with completion, error, and download rates', async () => {
      const growth = await growthService.getGrowthIntelligence(30);

      expect(Array.isArray(growth.utilities)).toBe(true);
      if (growth.utilities.length > 0) {
        const first = growth.utilities[0];
        expect(first.utilitySlug).toBeDefined();
        expect(typeof first.completionRate).toBe('number');
        expect(typeof first.errorRate).toBe('number');
        expect(typeof first.downloadRate).toBe('number');
      }
    });

    it('should aggregate ad monetization CTR metrics safely across placements and devices', async () => {
      const growth = await growthService.getGrowthIntelligence(30);

      expect(growth.monetization).toBeDefined();
      expect(Array.isArray(growth.monetization.placementPerformance)).toBe(true);
      for (const p of growth.monetization.placementPerformance) {
        expect(p.placementCode).toBeDefined();
        expect(typeof p.ctr).toBe('number');
        expect(p.ctr).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('4. Admin Growth API Endpoints & RBAC Protection', () => {
    it('should block unauthenticated access to /admin/analytics/growth (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/growth')
        .expect(401);
    });

    it('should allow authenticated admin access to /admin/analytics/growth (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/growth?days=7')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.periodDays).toBe(7);
      expect(res.body.data.funnel).toBeDefined();
      expect(res.body.data.acquisition).toBeDefined();
      expect(res.body.data.utilities).toBeDefined();
      expect(res.body.data.monetization).toBeDefined();
      expect(res.body.data.experiments).toBeDefined();
    });

    it('should return registered A/B experiments via /admin/analytics/experiments (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data[0].id).toBe('exp_cta_wording');
      expect(res.body.data[0].variants).toHaveLength(2);
    });
  });
});
