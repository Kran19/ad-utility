import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AdDeliveryService } from '../src/ads/services/ad-delivery.service';
import { TrackingTokenService } from '../src/ads/services/tracking-token.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { PlacementCode, CreativeType, CampaignStatus, DeviceType } from '@prisma/client';

jest.setTimeout(35000);

describe('Phase 31: Utility Page 4-Ad Minimum Monetization Inventory Verification', () => {
  let app: INestApplication;
  let adDeliveryService: AdDeliveryService;
  let trackingTokenService: TrackingTokenService;
  let prisma: PrismaService;
  let authService: AuthService;
  let superAdminToken: string;

  const FOUR_CORE_PLACEMENTS: PlacementCode[] = [
    PlacementCode.HEADER_BANNER,
    PlacementCode.TOP_CONTENT,
    PlacementCode.AFTER_TOOL,
    PlacementCode.BOTTOM_CONTENT,
  ];

  let testCampaignId: string;
  let testCreativeIds: string[] = [];

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

    adDeliveryService = moduleFixture.get<AdDeliveryService>(AdDeliveryService);
    trackingTokenService = moduleFixture.get<TrackingTokenService>(TrackingTokenService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    const superAdminLogin = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    superAdminToken = superAdminLogin.accessToken;

    // Create a dedicated active test campaign for 4 core placements
    const campaign = await prisma.adCampaign.create({
      data: {
        name: 'Phase 31 4-Core Placement Campaign',
        status: CampaignStatus.ACTIVE,
        priority: 90,
        weight: 100,
      },
    });
    testCampaignId = campaign.id;

    // Create unique creatives for all 4 core placements
    for (const p of FOUR_CORE_PLACEMENTS) {
      const creative = await prisma.adCreative.create({
        data: {
          name: `Phase 31 Creative for ${p}`,
          type: CreativeType.IMAGE,
          mediaUrl: `https://cdn.example.com/${p.toLowerCase()}.png`,
          targetUrl: `https://example.com/${p.toLowerCase()}`,
          width: 728,
          height: 90,
          altText: `4-Core Creative ${p}`,
        },
      });
      testCreativeIds.push(creative.id);

      const placementRecord = await prisma.adPlacement.findUnique({ where: { code: p } });
      if (placementRecord) {
        await prisma.adTargetingRule.create({
          data: {
            campaignId: testCampaignId,
            placementId: placementRecord.id,
            creativeId: creative.id,
            utilitySlugs: ['json-formatter'],
            categorySlugs: ['developer'],
            deviceTypes: [DeviceType.DESKTOP, DeviceType.TABLET, DeviceType.MOBILE],
            isActive: true,
          },
        });
      }
    }
  });

  afterAll(async () => {
    if (testCampaignId) {
      await prisma.adTargetingRule.deleteMany({ where: { campaignId: testCampaignId } });
      await prisma.adCreative.deleteMany({ where: { id: { in: testCreativeIds } } });
      await prisma.adCampaign.deleteMany({ where: { id: testCampaignId } });
    }
    await app.close();
  });

  describe('1. Four Core Placement Opportunities Audit', () => {
    it('should verify all 4 core placements exist in database placement records', async () => {
      const placements = await prisma.adPlacement.findMany({
        where: { code: { in: FOUR_CORE_PLACEMENTS } },
      });
      expect(placements.length).toBe(4);
      const codes = placements.map((p) => p.code);
      expect(codes).toContain(PlacementCode.HEADER_BANNER);
      expect(codes).toContain(PlacementCode.TOP_CONTENT);
      expect(codes).toContain(PlacementCode.AFTER_TOOL);
      expect(codes).toContain(PlacementCode.BOTTOM_CONTENT);
    });

    it('should serve ads independently on all 4 core placements for assigned utility (json-formatter)', async () => {
      for (const p of FOUR_CORE_PLACEMENTS) {
        const response = await adDeliveryService.getAdForSlot({
          placement: p as any,
          utilitySlug: 'json-formatter',
          categorySlug: 'developer',
          device: 'DESKTOP',
        });

        expect(response.hasAd).toBe(true);
        expect(response.placement).toBe(p);
        expect(response.creative).toBeDefined();
        expect(response.creative?.altText).toBe(`4-Core Creative ${p}`);
        expect(response.creative?.trackingToken).toBeDefined();
      }
    });
  });

  describe('2. Device & Responsive Targeting across 4 Core Placements', () => {
    it('should serve all 4 core placements on MOBILE device', async () => {
      for (const p of FOUR_CORE_PLACEMENTS) {
        const response = await adDeliveryService.getAdForSlot({
          placement: p as any,
          utilitySlug: 'json-formatter',
          categorySlug: 'developer',
          device: 'MOBILE',
        });

        expect(response.hasAd).toBe(true);
        expect(response.placement).toBe(p);
      }
    });

    it('should serve all 4 core placements on TABLET device', async () => {
      for (const p of FOUR_CORE_PLACEMENTS) {
        const response = await adDeliveryService.getAdForSlot({
          placement: p as any,
          utilitySlug: 'json-formatter',
          categorySlug: 'developer',
          device: 'TABLET',
        });

        expect(response.hasAd).toBe(true);
        expect(response.placement).toBe(p);
      }
    });
  });

  describe('3. Strict Utility Targeting & Unassigned Isolation', () => {
    it('should return clean no-ad (hasAd: false) on all 4 core placements for unassigned utility', async () => {
      for (const p of FOUR_CORE_PLACEMENTS) {
        const response = await adDeliveryService.getAdForSlot({
          placement: p as any,
          utilitySlug: 'unassigned-test-tool-xyz',
          categorySlug: 'unassigned-cat',
          device: 'DESKTOP',
        });

        expect(response.hasAd).toBe(false);
        expect(response.fallbackTier).toBe('TIER_5_NO_AD');
      }
    });
  });

  describe('4. Independent Impression & Click Tracking Flow', () => {
    it('should generate distinct verifiable tracking tokens for all 4 core placements', async () => {
      const tokens: string[] = [];

      for (const p of FOUR_CORE_PLACEMENTS) {
        const response = await adDeliveryService.getAdForSlot({
          placement: p as any,
          utilitySlug: 'json-formatter',
          device: 'DESKTOP',
        });

        expect(response.creative?.trackingToken).toBeDefined();
        const token = response.creative!.trackingToken;
        expect(tokens).not.toContain(token);
        tokens.push(token);

        const decoded = trackingTokenService.verifyToken(token);
        expect(decoded.placementCode).toBe(p);
        expect(decoded.utilitySlug).toBe('json-formatter');
      }

      expect(tokens.length).toBe(4);
    });

    it('should record impressions independently for each core placement', async () => {
      for (const p of FOUR_CORE_PLACEMENTS) {
        const adResponse = await adDeliveryService.getAdForSlot({
          placement: p as any,
          utilitySlug: 'json-formatter',
          device: 'DESKTOP',
        });

        const token = adResponse.creative!.trackingToken;

        const impRes = await request(app.getHttpServer())
          .post('/api/v1/ads/impression')
          .send({
            trackingToken: token,
            placement: p,
            utilitySlug: 'json-formatter',
            device: 'DESKTOP',
            sessionId: 'test_density_session',
          })
          .expect(200);

        expect(impRes.body.success).toBe(true);
        expect(impRes.body.data.recorded).toBe(true);
      }
    });
  });

  describe('5. Fail-Open Isolation & Non-Blocking Resilience', () => {
    it('should return clean no-ad when an individual placement is invalid without failing other requests', async () => {
      const invalidRes = await adDeliveryService.getAdForSlot({
        placement: 'INVALID_SLOT' as any,
        utilitySlug: 'json-formatter',
      });
      expect(invalidRes.hasAd).toBe(false);

      const validRes = await adDeliveryService.getAdForSlot({
        placement: 'TOP_CONTENT',
        utilitySlug: 'json-formatter',
      });
      expect(validRes.hasAd).toBe(true);
    });
  });

  describe('6. Admin Simulation & Placement Overview', () => {
    it('should simulate live ad selection on all 4 core placements via POST /api/v1/admin/ads/preview', async () => {
      for (const p of FOUR_CORE_PLACEMENTS) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/admin/ads/preview')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            utilitySlug: 'json-formatter',
            device: DeviceType.DESKTOP,
            placement: p,
          })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.placement).toBe(p);
        expect(res.body.data.hasAd).toBe(true);
      }
    });
  });
});
