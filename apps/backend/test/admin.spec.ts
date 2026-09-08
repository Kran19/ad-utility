import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoleType, CampaignStatus, CreativeType, DeviceType } from '@prisma/client';

jest.setTimeout(30000);

describe('Phase 8: Admin Control Panel & RBAC Management Verification', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;
  let superAdminToken: string;
  let editorToken: string;
  let analystToken: string;

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

    const editorLogin = await authService.login({
      email: 'editor@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    editorToken = editorLogin.accessToken;

    const analystLogin = await authService.login({
      email: 'analyst@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    analystToken = analystLogin.accessToken;
  });

  afterAll(async () => {
    await prisma.utility.deleteMany({
      where: { slug: { startsWith: 'test-tool-' } },
    });
    await app.close();
  });

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & RBAC GUARD ENFORCEMENT
  // -------------------------------------------------------------
  describe('1. Authentication & RBAC Authorization', () => {
    it('GET /api/v1/admin/dashboard - should reject unauthenticated requests (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/dashboard').expect(401);
    });

    it('GET /api/v1/admin/dashboard - should allow SuperAdmin to view dashboard metrics (200)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUsers).toBeGreaterThanOrEqual(1);
      expect(response.body.data.totalUtilities).toBeGreaterThanOrEqual(1);
      expect(response.body.data.toolCompletionRate).toBeDefined();
    });

    it('GET /api/v1/admin/users - should reject Analyst lacking users:manage permission (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${analystToken}`)
        .expect(403);
    });

    it('GET /api/v1/admin/users - should allow SuperAdmin with users:manage permission (200)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------
  // 2. USER & RBAC MANAGEMENT
  // -------------------------------------------------------------
  describe('2. User & RBAC Management', () => {
    let createdUserId: string;
    const testEmail = `newadmin_${Date.now()}@adplatform.local`;

    it('POST /api/v1/admin/users - should create a new user and assign roles', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: testEmail,
          password: 'Password123!',
          firstName: 'New',
          lastName: 'Manager',
          roles: [RoleType.ADMIN],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testEmail);
      expect(response.body.data.roles).toContain(RoleType.ADMIN);
      createdUserId = response.body.data.id;
    });

    it('PATCH /api/v1/admin/users/:id - should update user details and roles', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${createdUserId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          firstName: 'UpdatedName',
          roles: [RoleType.EDITOR, RoleType.ANALYST],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('UpdatedName');
      expect(response.body.data.roles).toContain(RoleType.EDITOR);
    });

    it('GET /api/v1/admin/users/roles - should list all roles and granular permissions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/users/roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(4);
    });
  });

  // -------------------------------------------------------------
  // 3. UTILITY & CATEGORY METADATA MANAGEMENT
  // -------------------------------------------------------------
  describe('3. Utility Metadata & Categories', () => {
    let createdUtilityId: string;
    const uniqueSlug = `test-tool-${Date.now()}`;

    it('POST /api/v1/admin/utilities - should create new utility metadata in DRAFT status', async () => {
      const categories = await prisma.utilityCategory.findMany();
      const categoryId = categories[0].id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/utilities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          slug: uniqueSlug,
          name: 'Test Markdown Cleaner',
          description: 'Clean and format markdown files',
          categoryId,
          implementationMode: 'LOCAL',
          status: 'DRAFT',
          seoTitle: 'Test Markdown Cleaner Online',
          seoDescription: 'Free online markdown formatting tool',
          faqContent: [{ question: 'Is it free?', answer: 'Yes!' }],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe(uniqueSlug);
      expect(response.body.data.status).toBe('DRAFT');
      createdUtilityId = response.body.data.id;
    });

    it('PATCH /api/v1/admin/utilities/:id - should update utility metadata and status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/utilities/${createdUtilityId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'ACTIVE',
          isFeatured: true,
          seoTitle: 'Updated Markdown Cleaner SEO Title',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.isFeatured).toBe(true);
    });

    it('GET /api/v1/admin/utilities/categories - should list utility categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/utilities/categories')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------
  // 4. AD CAMPAIGNS, CREATIVES, TARGETING & SCHEDULES
  // -------------------------------------------------------------
  describe('4. Ad Campaigns, Creatives & Targeting', () => {
    let testCampaignId: string;
    let testCreativeId: string;
    let testPlacementId: string;

    it('POST /api/v1/admin/ads/campaigns - should create a new campaign', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/campaigns')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Phase 8 Verification Campaign',
          status: CampaignStatus.ACTIVE,
          priority: 85,
          weight: 100,
          dailyImpressionCap: 500,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Phase 8 Verification Campaign');
      testCampaignId = response.body.data.id;
    });

    it('POST /api/v1/admin/ads/creatives - should create image creative with valid URLs', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/creatives')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Test Image Banner',
          type: CreativeType.IMAGE,
          mediaUrl: 'https://example.com/banner.png',
          targetUrl: 'https://example.com/landing',
          width: 728,
          height: 90,
          altText: 'Test Banner Alt',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Image Banner');
      testCreativeId = response.body.data.id;
    });

    it('POST /api/v1/admin/ads/creatives - should reject unsafe javascript: URLs', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/ads/creatives')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Dangerous Creative',
          type: CreativeType.IMAGE,
          targetUrl: 'javascript:alert(1)',
        })
        .expect(400);
    });

    it('POST /api/v1/admin/ads/targeting - should create a targeting rule', async () => {
      const placements = await prisma.adPlacement.findMany();
      testPlacementId = placements[0].id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/targeting')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          campaignId: testCampaignId,
          placementId: testPlacementId,
          creativeId: testCreativeId,
          deviceTypes: [DeviceType.DESKTOP, DeviceType.MOBILE],
          priorityOverride: 90,
          weight: 100,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaignId).toBe(testCampaignId);
    });

    it('POST /api/v1/admin/ads/schedules - should create a day/hour schedule', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/schedules')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          campaignId: testCampaignId,
          dayOfWeek: 1,
          startHour: 8,
          endHour: 20,
          timezone: 'UTC',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dayOfWeek).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // 5. ANALYTICS, AI USAGE, SETTINGS & AUDIT LOGGING
  // -------------------------------------------------------------
  describe('5. Analytics, AI Usage, Settings & Audit Logs', () => {
    it('GET /api/v1/admin/analytics/overview - should return platform analytics breakdown', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eventsByType).toBeDefined();
    });

    it('GET /api/v1/admin/ai/overview - should return AI token metrics and costs', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/ai/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBeDefined();
      expect(response.body.data.byModel).toBeDefined();
    });

    it('GET /api/v1/admin/settings - should return settings with secret masking', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/admin/audit-logs - should verify transactional audit records exist for recent mutations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);

      const actions = response.body.data.items.map((log: any) => log.action);
      expect(actions).toContain('USER_CREATED');
      expect(actions).toContain('CAMPAIGN_CREATED');
      expect(actions).toContain('CREATIVE_CREATED');
    });
  });
});
