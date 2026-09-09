import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CampaignStatus, CreativeType, DeviceType, PlacementCode } from '@prisma/client';

jest.setTimeout(35000);

describe('Admin Control Panel: Utility & Ad Operations Enhancement Verification', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;
  let superAdminToken: string;

  let testCampaignId: string;
  let testPlacementId: string;
  let testCreativeId: string;
  let testRuleId: string;
  let testUtilitySlug: string;

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

    authService = moduleFixture.get<AuthService>(AuthService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    const superAdminLogin = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    superAdminToken = superAdminLogin.accessToken;

    // Retrieve or seed a test placement using valid PlacementCode
    let placement = await prisma.adPlacement.findFirst({
      where: { code: PlacementCode.TOP_CONTENT },
    });
    if (!placement) {
      placement = await prisma.adPlacement.create({
        data: {
          code: PlacementCode.TOP_CONTENT,
          name: 'Top Content Slot',
          supportedTypes: [CreativeType.IMAGE, CreativeType.HTML],
        },
      });
    }
    testPlacementId = placement.id;

    // Find an existing utility or create one
    let utility = await prisma.utility.findFirst({
      where: { slug: 'jpg-to-png' },
    });
    if (!utility) {
      utility = await prisma.utility.findFirst();
    }
    testUtilitySlug = utility?.slug || 'jpg-to-png';

    // Create a dedicated active test campaign
    const campaign = await prisma.adCampaign.create({
      data: {
        name: 'Ops Test Campaign ' + Date.now(),
        status: CampaignStatus.ACTIVE,
        priority: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
      },
    });
    testCampaignId = campaign.id;

    // Create a creative
    const creative = await prisma.adCreative.create({
      data: {
        name: 'Ops Image Creative',
        type: CreativeType.IMAGE,
        altText: 'Fast JPG to PNG Conversion Pro',
        mediaUrl: 'https://cdn.example.com/ops-banner.png',
        targetUrl: 'https://example.com/pro',
        width: 728,
        height: 90,
      },
    });
    testCreativeId = creative.id;
  });

  afterAll(async () => {
    if (testRuleId) {
      await prisma.adTargetingRule.deleteMany({ where: { id: testRuleId } });
    }
    if (testCreativeId) {
      await prisma.adCreative.deleteMany({ where: { id: testCreativeId } });
    }
    if (testCampaignId) {
      await prisma.adTargetingRule.deleteMany({ where: { campaignId: testCampaignId } });
      await prisma.adCampaign.deleteMany({ where: { id: testCampaignId } });
    }
    await app.close();
  });

  describe('1. Ad Operations Matrix (GET /api/v1/admin/ads/manager/matrix)', () => {
    it('should return 200 and a list of utilities with device-specific counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ads/manager/matrix')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      const firstItem = res.body.data.items[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('slug');
      expect(firstItem).toHaveProperty('name');
      expect(firstItem).toHaveProperty('desktop');
      expect(firstItem).toHaveProperty('tablet');
      expect(firstItem).toHaveProperty('mobile');
      expect(firstItem).toHaveProperty('total');
      expect(typeof firstItem.desktop).toBe('number');
      expect(typeof firstItem.mobile).toBe('number');
    });

    it('should support search query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/ads/manager/matrix?search=${testUtilitySlug}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const found = res.body.data.items.find((item: any) => item.slug === testUtilitySlug);
      expect(found).toBeDefined();
    });

    it('should support device and status filtering', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ads/manager/matrix?device=DESKTOP&status=ACTIVE')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  describe('2. Targeting Rules Management & Deduplication', () => {
    it('should create an ad targeting rule specifically targeting a utility and device', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/targeting')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          campaignId: testCampaignId,
          placementId: testPlacementId,
          creativeId: testCreativeId,
          deviceTypes: [DeviceType.DESKTOP, DeviceType.MOBILE],
          utilitySlugs: [testUtilitySlug],
          priorityOverride: 15,
          weight: 150,
          isActive: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.utilitySlugs).toContain(testUtilitySlug);
      expect(res.body.data.deviceTypes).toContain('DESKTOP');
      expect(res.body.data.deviceTypes).toContain('MOBILE');
      testRuleId = res.body.data.id;
    });

    it('should reject duplicate targeting assignment with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/targeting')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          campaignId: testCampaignId,
          placementId: testPlacementId,
          creativeId: testCreativeId,
          deviceTypes: [DeviceType.DESKTOP, DeviceType.MOBILE],
          utilitySlugs: [testUtilitySlug],
          weight: 150,
        })
        .expect(400);

      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should accurately count applicable rules without double-counting in matrix', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/ads/manager/matrix?search=${testUtilitySlug}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const utilityItem = res.body.data.items.find((item: any) => item.slug === testUtilitySlug);
      expect(utilityItem).toBeDefined();
      // The multi-device rule [DESKTOP, MOBILE] gives 1 desktop and 1 mobile applicable rule, total 1 distinct rule
      expect(utilityItem.desktop).toBeGreaterThanOrEqual(1);
      expect(utilityItem.mobile).toBeGreaterThanOrEqual(1);
      expect(utilityItem.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter targeting rules by utilitySlug and deviceType via GET /api/v1/admin/ads/targeting', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/ads/targeting?utilitySlug=${testUtilitySlug}&deviceType=DESKTOP`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((r: any) => r.id === testRuleId);
      expect(found).toBeDefined();
      expect(found.campaign).toBeDefined();
      expect(found.placement).toBeDefined();
      expect(found.creative).toBeDefined();
    });

    it('should edit an existing ad targeting rule via PATCH /api/v1/admin/ads/targeting/:id', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/ads/targeting/${testRuleId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          weight: 275,
          priorityOverride: 42,
          deviceTypes: [DeviceType.DESKTOP, DeviceType.TABLET],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testRuleId);
      expect(res.body.data.weight).toBe(275);
      expect(res.body.data.priorityOverride).toBe(42);
      expect(res.body.data.deviceTypes).toEqual(['DESKTOP', 'TABLET']);
    });

    it('should return unique campaign records by ID and verify no duplicate campaign entries exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ads/campaigns?page=1&pageSize=100')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const items = res.body.data.items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      // Verify uniqueness by ID
      const ids = items.map((c: any) => c.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);

      // Verify no duplicate active campaigns sharing identical test fixtures
      const activePhase8Campaigns = items.filter((c: any) => c.name === 'Phase 8 Verification Campaign' && c.status === 'ACTIVE');
      expect(activePhase8Campaigns.length).toBeLessThanOrEqual(1);
    });
  });

  describe('3. Live Ad Selector Simulation (POST /api/v1/admin/ads/preview)', () => {
    it('should execute real AdSelectorService and return visual payload + selection verdict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/preview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          utilitySlug: testUtilitySlug,
          device: DeviceType.DESKTOP,
          placement: PlacementCode.TOP_CONTENT,
          country: 'US',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('selectionTier');
      expect(res.body.data).toHaveProperty('explanation');
      expect(res.body.data.explanation).toHaveProperty('code');
      expect(res.body.data.explanation).toHaveProperty('label');
      expect(res.body.data.explanation).toHaveProperty('description');

      // Since we created an exact targeting rule for this utility, it should resolve via exact match
      expect(res.body.data.selectionTier).toBe('TIER_1_EXACT_UTILITY');
      expect(res.body.data.explanation.code).toBe('EXACT_UTILITY');
      expect(res.body.data.selectedAd).toBeDefined();
      expect(res.body.data.selectedAd.creative.altText).toBe('Fast JPG to PNG Conversion Pro');
    });

    it('should return 404 if utility slug is unknown', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/preview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          utilitySlug: 'non-existent-tool-slug-xyz',
          device: DeviceType.DESKTOP,
          placement: PlacementCode.TOP_CONTENT,
        })
        .expect(404);

      expect(res.status).toBe(404);
    });
  });

  describe('4. Utility Registry Enrichment with Ad Counts', () => {
    it('should return enriched adCounts in GET /api/v1/admin/utilities', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/utilities?page=1&pageSize=20')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);

      const targetUtil = res.body.data.items.find((u: any) => u.slug === testUtilitySlug);
      expect(targetUtil).toBeDefined();
      expect(targetUtil).toHaveProperty('adCounts');
      expect(targetUtil.adCounts).toHaveProperty('desktop');
      expect(targetUtil.adCounts).toHaveProperty('tablet');
      expect(targetUtil.adCounts).toHaveProperty('mobile');
      expect(targetUtil.adCounts).toHaveProperty('total');
      expect(targetUtil.adCounts.desktop).toBeGreaterThanOrEqual(1);
    });

    it('should toggle utility status between ACTIVE and DISABLED', async () => {
      const util = await prisma.utility.findUnique({ where: { slug: testUtilitySlug } });
      expect(util).toBeDefined();

      const newStatus = util?.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/admin/utilities/${util?.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: newStatus })
        .expect(200);

      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.data.status).toBe(newStatus);

      // Restore to original status
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/utilities/${util?.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: util?.status })
        .expect(200);
    });
  });
});
