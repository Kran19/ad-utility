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

describe('Phase 30: Standardized Ad Placement Inventory Verification', () => {
  let app: INestApplication;
  let adDeliveryService: AdDeliveryService;
  let trackingTokenService: TrackingTokenService;
  let prisma: PrismaService;
  let authService: AuthService;
  let superAdminToken: string;

  const CANONICAL_PLACEMENTS: PlacementCode[] = [
    PlacementCode.HEADER_BANNER,
    PlacementCode.TOP_CONTENT,
    PlacementCode.AFTER_TOOL,
    PlacementCode.MID_CONTENT,
    PlacementCode.BOTTOM_CONTENT,
    PlacementCode.SIDEBAR,
    PlacementCode.MOBILE_STICKY,
    PlacementCode.DESKTOP_STICKY,
  ];

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Canonical Placement Inventory Registry Audit', () => {
    it('should have all 8 canonical placements registered in the database', async () => {
      const placements = await prisma.adPlacement.findMany();
      const placementCodes = placements.map((p) => p.code);

      for (const canonical of CANONICAL_PLACEMENTS) {
        expect(placementCodes).toContain(canonical);
      }
      expect(placements.length).toBeGreaterThanOrEqual(8);
    });

    it('GET /api/v1/admin/ads/placements should return all 8 canonical placements via Admin API', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/ads/placements')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const returnedCodes = res.body.data.map((p: any) => p.code);

      for (const canonical of CANONICAL_PLACEMENTS) {
        expect(returnedCodes).toContain(canonical);
      }
    });
  });

  describe('2. Canonical Placements Delivery & Device Targeting', () => {
    let testCampaignId: string;
    let testHeaderCreativeId: string;
    let testSidebarCreativeId: string;
    let testMobileStickyCreativeId: string;

    beforeAll(async () => {
      // Create dedicated active test campaign
      const campaign = await prisma.adCampaign.create({
        data: {
          name: 'Phase 30 Inventory Test Campaign',
          status: CampaignStatus.ACTIVE,
          priority: 85,
          weight: 100,
        },
      });
      testCampaignId = campaign.id;

      // Create creative for HEADER_BANNER (Desktop/Mobile)
      const headerCreative = await prisma.adCreative.create({
        data: {
          name: 'Header Banner Creative',
          type: CreativeType.IMAGE,
          mediaUrl: 'https://cdn.example.com/header-banner.png',
          targetUrl: 'https://example.com/header',
          width: 728,
          height: 90,
          altText: 'Header Placement Ad',
        },
      });
      testHeaderCreativeId = headerCreative.id;

      // Create creative for SIDEBAR (Desktop)
      const sidebarCreative = await prisma.adCreative.create({
        data: {
          name: 'Sidebar Creative',
          type: CreativeType.IMAGE,
          mediaUrl: 'https://cdn.example.com/sidebar.png',
          targetUrl: 'https://example.com/sidebar',
          width: 300,
          height: 250,
          altText: 'Sidebar Placement Ad',
        },
      });
      testSidebarCreativeId = sidebarCreative.id;

      // Create creative for MOBILE_STICKY (Mobile)
      const mobileStickyCreative = await prisma.adCreative.create({
        data: {
          name: 'Mobile Sticky Creative',
          type: CreativeType.IMAGE,
          mediaUrl: 'https://cdn.example.com/mobile-sticky.png',
          targetUrl: 'https://example.com/mobile-sticky',
          width: 320,
          height: 50,
          altText: 'Mobile Sticky Ad',
        },
      });
      testMobileStickyCreativeId = mobileStickyCreative.id;

      const headerPlacement = await prisma.adPlacement.findUnique({ where: { code: PlacementCode.HEADER_BANNER } });
      const sidebarPlacement = await prisma.adPlacement.findUnique({ where: { code: PlacementCode.SIDEBAR } });
      const mobileStickyPlacement = await prisma.adPlacement.findUnique({ where: { code: PlacementCode.MOBILE_STICKY } });

      // Create targeting rules for test utility 'json-formatter'
      if (headerPlacement) {
        await prisma.adTargetingRule.create({
          data: {
            campaignId: testCampaignId,
            placementId: headerPlacement.id,
            creativeId: testHeaderCreativeId,
            utilitySlugs: ['json-formatter'],
            deviceTypes: [DeviceType.DESKTOP, DeviceType.TABLET, DeviceType.MOBILE],
            isActive: true,
          },
        });
      }

      if (sidebarPlacement) {
        await prisma.adTargetingRule.create({
          data: {
            campaignId: testCampaignId,
            placementId: sidebarPlacement.id,
            creativeId: testSidebarCreativeId,
            utilitySlugs: ['json-formatter'],
            deviceTypes: [DeviceType.DESKTOP],
            isActive: true,
          },
        });
      }

      if (mobileStickyPlacement) {
        await prisma.adTargetingRule.create({
          data: {
            campaignId: testCampaignId,
            placementId: mobileStickyPlacement.id,
            creativeId: testMobileStickyCreativeId,
            utilitySlugs: ['json-formatter'],
            deviceTypes: [DeviceType.MOBILE],
            isActive: true,
          },
        });
      }
    });

    afterAll(async () => {
      await prisma.adTargetingRule.deleteMany({ where: { campaignId: testCampaignId } });
      await prisma.adCreative.deleteMany({
        where: { id: { in: [testHeaderCreativeId, testSidebarCreativeId, testMobileStickyCreativeId] } },
      });
      await prisma.adCampaign.deleteMany({ where: { id: testCampaignId } });
    });

    it('should serve HEADER_BANNER on json-formatter across desktop and mobile', async () => {
      const desktopRes = await adDeliveryService.getAdForSlot({
        placement: 'HEADER_BANNER',
        utilitySlug: 'json-formatter',
        device: 'DESKTOP',
      });
      expect(desktopRes.hasAd).toBe(true);
      expect(desktopRes.placement).toBe('HEADER_BANNER');
      expect(desktopRes.creative?.altText).toBe('Header Placement Ad');

      const mobileRes = await adDeliveryService.getAdForSlot({
        placement: 'HEADER_BANNER',
        utilitySlug: 'json-formatter',
        device: 'MOBILE',
      });
      expect(mobileRes.hasAd).toBe(true);
      expect(mobileRes.placement).toBe('HEADER_BANNER');
    });

    it('should serve SIDEBAR on DESKTOP device when assigned to json-formatter', async () => {
      const res = await adDeliveryService.getAdForSlot({
        placement: 'SIDEBAR',
        utilitySlug: 'json-formatter',
        device: 'DESKTOP',
      });
      expect(res.hasAd).toBe(true);
      expect(res.placement).toBe('SIDEBAR');
      expect(res.creative?.altText).toBe('Sidebar Placement Ad');
    });

    it('should serve MOBILE_STICKY on MOBILE device when assigned to json-formatter', async () => {
      const res = await adDeliveryService.getAdForSlot({
        placement: 'MOBILE_STICKY',
        utilitySlug: 'json-formatter',
        device: 'MOBILE',
      });
      expect(res.hasAd).toBe(true);
      expect(res.placement).toBe('MOBILE_STICKY');
      expect(res.creative?.altText).toBe('Mobile Sticky Ad');
    });
  });

  describe('3. Strict Utility Assignment & Fallback Semantics', () => {
    it('should return clean no-ad (hasAd: false) on unassigned tools for canonical placements', async () => {
      const res = await adDeliveryService.getAdForSlot({
        placement: 'BOTTOM_CONTENT',
        utilitySlug: 'unassigned-random-tool-12345',
        device: 'DESKTOP',
      });
      expect(res.hasAd).toBe(false);
      expect(res.fallbackTier).toBe('TIER_5_NO_AD');
    });

    it('should cleanly reject unknown or arbitrary placement codes', async () => {
      const res = await adDeliveryService.getAdForSlot({
        placement: 'NON_EXISTENT_CUSTOM_BANNER' as any,
        utilitySlug: 'json-formatter',
        device: 'DESKTOP',
      });
      expect(res.hasAd).toBe(false);
      expect(res.fallbackTier).toBe('TIER_5_NO_AD');
    });
  });

  describe('4. Live Ad Selector Simulation (POST /api/v1/admin/ads/preview)', () => {
    it('should execute simulation and return canonical placement evaluation report', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/preview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          utilitySlug: 'json-formatter',
          device: DeviceType.DESKTOP,
          placement: PlacementCode.HEADER_BANNER,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.placement).toBe('HEADER_BANNER');
      expect(res.body.data).toHaveProperty('selectionTier');
      expect(res.body.data).toHaveProperty('explanation');
      expect(res.body.data).toHaveProperty('device', 'DESKTOP');
    });
  });
});
