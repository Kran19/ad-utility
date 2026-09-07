import {
  PrismaClient,
  RoleType,
  PlacementCode,
  UtilityStatus,
  UtilityExecutionMode,
  CampaignStatus,
  CreativeType,
  DeviceType,
} from '@prisma/client';

describe('Phase 2: Database Architecture & Prisma Verification', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Database Connectivity', () => {
    it('should successfully execute a raw query to PostgreSQL', async () => {
      const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
      expect(result).toBeDefined();
      expect(result[0].result).toBe(1);
    });
  });

  describe('2. RBAC Seed Verification', () => {
    it('should have all 4 required system roles seeded', async () => {
      const roles = await prisma.role.findMany();
      const roleNames = roles.map((r) => r.name);

      expect(roleNames).toContain(RoleType.SUPER_ADMIN);
      expect(roleNames).toContain(RoleType.ADMIN);
      expect(roleNames).toContain(RoleType.EDITOR);
      expect(roleNames).toContain(RoleType.ANALYST);
    });

    it('should have permissions seeded and mapped to SUPER_ADMIN', async () => {
      const superAdminRole = await prisma.role.findUnique({
        where: { name: RoleType.SUPER_ADMIN },
        include: { rolePermissions: { include: { permission: true } } },
      });

      expect(superAdminRole).toBeDefined();
      expect(superAdminRole?.rolePermissions.length).toBeGreaterThan(15);
    });
  });

  describe('3. Utility Metadata Layer Seed & Integrity Verification', () => {
    it('should have initial 5 utility categories seeded', async () => {
      const categories = await prisma.utilityCategory.findMany();
      const slugs = categories.map((c) => c.slug);

      expect(slugs).toContain('image');
      expect(slugs).toContain('pdf');
      expect(slugs).toContain('text');
      expect(slugs).toContain('developer');
      expect(slugs).toContain('ai');
    });

    it('should enforce unique constraint on utility slug', async () => {
      const imageCategory = await prisma.utilityCategory.findUnique({ where: { slug: 'image' } });
      expect(imageCategory).toBeDefined();

      const testSlug = `test-tool-${Date.now()}`;
      const created = await prisma.utility.create({
        data: {
          slug: testSlug,
          name: 'Test Tool',
          description: 'A test utility',
          categoryId: imageCategory!.id,
          implementationMode: UtilityExecutionMode.LOCAL,
          status: UtilityStatus.ACTIVE,
          seoTitle: 'Test Tool Title',
          seoDescription: 'Test Tool Description',
        },
      });

      expect(created.id).toBeDefined();

      // Attempt duplicate slug creation
      await expect(
        prisma.utility.create({
          data: {
            slug: testSlug,
            name: 'Duplicate Tool',
            description: 'Duplicate',
            categoryId: imageCategory!.id,
            implementationMode: UtilityExecutionMode.LOCAL,
            status: UtilityStatus.ACTIVE,
            seoTitle: 'Duplicate',
            seoDescription: 'Duplicate',
          },
        }),
      ).rejects.toThrow();

      // Cleanup
      await prisma.utility.delete({ where: { id: created.id } });
    });

    it('should prevent deletion of Category when active utilities reference it (RESTRICT)', async () => {
      const cat = await prisma.utilityCategory.create({
        data: {
          slug: `test-cat-${Date.now()}`,
          name: 'Temporary Category',
        },
      });

      const util = await prisma.utility.create({
        data: {
          slug: `temp-tool-${Date.now()}`,
          name: 'Temp Tool',
          description: 'Temp',
          categoryId: cat.id,
          seoTitle: 'Temp',
          seoDescription: 'Temp',
        },
      });

      // Attempt deleting category while utility is attached
      await expect(prisma.utilityCategory.delete({ where: { id: cat.id } })).rejects.toThrow();

      // Cleanup
      await prisma.utility.delete({ where: { id: util.id } });
      await prisma.utilityCategory.delete({ where: { id: cat.id } });
    });
  });

  describe('4. Advertising Engine Multi-Device Targeting & Creative Reuse Audit', () => {
    it('should have all 8 standardized ad placements seeded', async () => {
      const placements = await prisma.adPlacement.findMany();
      const codes = placements.map((p) => p.code);

      expect(codes).toContain(PlacementCode.HEADER_BANNER);
      expect(codes).toContain(PlacementCode.TOP_CONTENT);
      expect(codes).toContain(PlacementCode.AFTER_TOOL);
      expect(codes).toContain(PlacementCode.MID_CONTENT);
      expect(codes).toContain(PlacementCode.BOTTOM_CONTENT);
      expect(codes).toContain(PlacementCode.SIDEBAR);
      expect(codes).toContain(PlacementCode.MOBILE_STICKY);
      expect(codes).toContain(PlacementCode.DESKTOP_STICKY);
    });

    it('should support UTILITY + PLACEMENT + DEVICE + CREATIVE matrix and creative reuse', async () => {
      const topContentPlacement = await prisma.adPlacement.findUnique({
        where: { code: PlacementCode.TOP_CONTENT },
      });
      const afterToolPlacement = await prisma.adPlacement.findUnique({
        where: { code: PlacementCode.AFTER_TOOL },
      });
      const bottomContentPlacement = await prisma.adPlacement.findUnique({
        where: { code: PlacementCode.BOTTOM_CONTENT },
      });

      expect(topContentPlacement).toBeDefined();
      expect(afterToolPlacement).toBeDefined();
      expect(bottomContentPlacement).toBeDefined();

      // Create Campaign
      const campaign = await prisma.adCampaign.create({
        data: {
          name: `Multi-Device Campaign ${Date.now()}`,
          status: CampaignStatus.ACTIVE,
          priority: 90,
          weight: 100,
        },
      });

      // Create Creatives A, B, C, D
      const creativeA = await prisma.adCreative.create({
        data: { name: 'Creative A (Mobile 320x50)', type: CreativeType.IMAGE, width: 320, height: 50 },
      });
      const creativeB = await prisma.adCreative.create({
        data: { name: 'Creative B (Tablet 468x60)', type: CreativeType.IMAGE, width: 468, height: 60 },
      });
      const creativeC = await prisma.adCreative.create({
        data: { name: 'Creative C (Desktop 728x90)', type: CreativeType.IMAGE, width: 728, height: 90 },
      });
      const creativeD = await prisma.adCreative.create({
        data: { name: 'Creative D (AfterTool Mobile)', type: CreativeType.HTML, customHtml: '<div>Ad D</div>' },
      });

      // 1. /jpg-to-png + TOP_CONTENT + MOBILE => Creative A
      const ruleMobile = await prisma.adTargetingRule.create({
        data: {
          campaignId: campaign.id,
          placementId: topContentPlacement!.id,
          creativeId: creativeA.id,
          deviceTypes: [DeviceType.MOBILE],
          utilitySlugs: ['jpg-to-png'],
        },
      });

      // 2. /jpg-to-png + TOP_CONTENT + TABLET => Creative B
      const ruleTablet = await prisma.adTargetingRule.create({
        data: {
          campaignId: campaign.id,
          placementId: topContentPlacement!.id,
          creativeId: creativeB.id,
          deviceTypes: [DeviceType.TABLET],
          utilitySlugs: ['jpg-to-png'],
        },
      });

      // 3. /jpg-to-png + TOP_CONTENT + DESKTOP => Creative C
      const ruleDesktop = await prisma.adTargetingRule.create({
        data: {
          campaignId: campaign.id,
          placementId: topContentPlacement!.id,
          creativeId: creativeC.id,
          deviceTypes: [DeviceType.DESKTOP],
          utilitySlugs: ['jpg-to-png'],
        },
      });

      // 4. /jpg-to-png + AFTER_TOOL + MOBILE => Creative D
      const ruleAfterTool = await prisma.adTargetingRule.create({
        data: {
          campaignId: campaign.id,
          placementId: afterToolPlacement!.id,
          creativeId: creativeD.id,
          deviceTypes: [DeviceType.MOBILE],
          utilitySlugs: ['jpg-to-png'],
        },
      });

      // 5. Creative Reuse: Creative A reused for /png-to-jpg + BOTTOM_CONTENT
      const ruleReused = await prisma.adTargetingRule.create({
        data: {
          campaignId: campaign.id,
          placementId: bottomContentPlacement!.id,
          creativeId: creativeA.id,
          deviceTypes: [DeviceType.MOBILE, DeviceType.TABLET],
          utilitySlugs: ['png-to-jpg'],
        },
      });

      // Query verification
      const rules = await prisma.adTargetingRule.findMany({
        where: { campaignId: campaign.id },
        include: { creative: true, placement: true },
      });

      expect(rules.length).toBe(5);

      // Verify specific queries
      const foundMobileTop = rules.find(
        (r) => r.placement.code === PlacementCode.TOP_CONTENT && r.deviceTypes.includes(DeviceType.MOBILE),
      );
      expect(foundMobileTop?.creativeId).toBe(creativeA.id);

      const foundTabletTop = rules.find(
        (r) => r.placement.code === PlacementCode.TOP_CONTENT && r.deviceTypes.includes(DeviceType.TABLET),
      );
      expect(foundTabletTop?.creativeId).toBe(creativeB.id);

      const foundDesktopTop = rules.find(
        (r) => r.placement.code === PlacementCode.TOP_CONTENT && r.deviceTypes.includes(DeviceType.DESKTOP),
      );
      expect(foundDesktopTop?.creativeId).toBe(creativeC.id);

      const foundAfterTool = rules.find(
        (r) => r.placement.code === PlacementCode.AFTER_TOOL && r.deviceTypes.includes(DeviceType.MOBILE),
      );
      expect(foundAfterTool?.creativeId).toBe(creativeD.id);

      // Cleanup
      await prisma.adCampaign.delete({ where: { id: campaign.id } });
      await prisma.adCreative.delete({ where: { id: creativeA.id } });
      await prisma.adCreative.delete({ where: { id: creativeB.id } });
      await prisma.adCreative.delete({ where: { id: creativeC.id } });
      await prisma.adCreative.delete({ where: { id: creativeD.id } });
    });
  });

  describe('5. Audit Log Actor Lifecycle (SET NULL)', () => {
    it('should retain audit log records when actor user is deleted', async () => {
      const user = await prisma.user.create({
        data: {
          email: `audit-actor-${Date.now()}@example.com`,
          passwordHash: 'dummy_hash',
        },
      });

      const auditLog = await prisma.auditLog.create({
        data: {
          action: 'CAMPAIGN_CREATE',
          entityType: 'AdCampaign',
          entityId: 'camp-123',
          actorUserId: user.id,
          actorEmail: user.email,
          details: { name: 'Audit Test Campaign' },
        },
      });

      expect(auditLog.actorUserId).toBe(user.id);

      // Delete user
      await prisma.user.delete({ where: { id: user.id } });

      // Audit log must still exist with actorUserId = null
      const retainedLog = await prisma.auditLog.findUnique({ where: { id: auditLog.id } });
      expect(retainedLog).toBeDefined();
      expect(retainedLog?.actorUserId).toBeNull();
      expect(retainedLog?.actorEmail).toBe(user.email);

      // Cleanup
      await prisma.auditLog.delete({ where: { id: auditLog.id } });
    });
  });

  describe('6. AI & Telemetry Event Verification', () => {
    it('should insert and query an AiRequest record', async () => {
      const aiReq = await prisma.aiRequest.create({
        data: {
          requestId: `req-${Date.now()}`,
          utilitySlug: 'ai-humanizer',
          model: 'gpt-4o-mini',
          inputTokens: 120,
          outputTokens: 80,
          totalTokens: 200,
          estimatedCostUsd: 0.0003,
          durationMs: 850,
        },
      });

      expect(aiReq.id).toBeDefined();
      expect(aiReq.totalTokens).toBe(200);

      await prisma.aiRequest.delete({ where: { id: aiReq.id } });
    });

    it('should insert and query an AnalyticsEvent record', async () => {
      const event = await prisma.analyticsEvent.create({
        data: {
          eventType: 'tool_complete',
          utilitySlug: 'jpg-to-png',
          sessionToken: 'sess-abc-123',
          utmSource: 'google',
          utmMedium: 'organic',
          metadata: { executionTimeMs: 42, fileSizeBefore: 1024, fileSizeAfter: 512 },
        },
      });

      expect(event.id).toBeDefined();
      expect(event.eventType).toBe('tool_complete');

      await prisma.analyticsEvent.delete({ where: { id: event.id } });
    });
  });
});
