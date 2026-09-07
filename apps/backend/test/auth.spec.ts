import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { RequirePermissions } from '../src/auth/decorators/permissions.decorator';

// Test Controller for Guard End-to-End Validation
@Controller('test-guard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
class TestGuardController {
  @Get('admin-only')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminOnly() {
    return { success: true, message: 'Welcome Admin' };
  }

  @Get('super-admin-only')
  @Roles('SUPER_ADMIN')
  superAdminOnly() {
    return { success: true, message: 'Welcome Super Admin' };
  }

  @Get('campaigns-create')
  @RequirePermissions('campaigns:create')
  campaignsCreate() {
    return { success: true, message: 'Can create campaigns' };
  }
}

jest.setTimeout(30000);

describe('Phase 3: Authentication & RBAC Verification', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;

  let superAdminToken: string;
  let editorToken: string;
  let analystToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestGuardController],
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

    // Acquire tokens for testing
    const adminLogin = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    superAdminToken = adminLogin.accessToken;
    refreshToken = adminLogin.refreshToken;

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
    await app.close();
  });

  describe('1. AuthService & Credentials Validation', () => {
    it('should successfully validate credentials for super admin', async () => {
      const profile = await authService.validateUser('admin@adplatform.local', 'AdminSecurePassword123!');
      expect(profile).toBeDefined();
      expect(profile.email).toBe('admin@adplatform.local');
      expect(profile.roles).toContain('SUPER_ADMIN');
      expect(profile.permissions.length).toBeGreaterThan(15);
    });

    it('should reject invalid password and throw UnauthorizedException', async () => {
      await expect(
        authService.validateUser('admin@adplatform.local', 'WrongPassword123!'),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent email and throw UnauthorizedException', async () => {
      await expect(
        authService.validateUser('nonexistent@example.com', 'SomePassword123!'),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('2. Login & Token Generation Flow (HTTP)', () => {
    it('POST /api/v1/auth/login - should log in and return tokens & profile', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@adplatform.local',
          password: 'AdminSecurePassword123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe('admin@adplatform.local');
      expect(response.body.data.user.roles).toContain('SUPER_ADMIN');
    });

    it('POST /api/v1/auth/login - should fail with 401 on bad password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@adplatform.local',
          password: 'IncorrectPassword',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('POST /api/v1/auth/refresh - should refresh access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('POST /api/v1/auth/refresh - should fail with 401 on malformed refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.jwt.token' })
        .expect(401);
    });

    it('GET /api/v1/auth/me - should return authenticated user profile with Bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('admin@adplatform.local');
      expect(response.body.data.roles).toContain('SUPER_ADMIN');
    });

    it('GET /api/v1/auth/me - should reject request without Bearer token (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('POST /api/v1/auth/logout - should return success envelope', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out successfully');
    });
  });

  describe('3. Audit Log Tracking on Auth Events', () => {
    it('should record LOGIN_SUCCESS in audit_logs', async () => {
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGIN_SUCCESS',
          actorEmail: 'admin@adplatform.local',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log?.entityType).toBe('User');
    });

    it('should record LOGIN_FAILED in audit_logs', async () => {
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGIN_FAILED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log?.entityType).toBe('User');
    });
  });

  describe('4. RBAC & Permissions Guard Enforcement', () => {
    it('GET /api/v1/test-guard/super-admin-only - should allow SUPER_ADMIN (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-guard/super-admin-only')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/test-guard/super-admin-only - should block EDITOR with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-guard/super-admin-only')
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403);

      expect(res.body.message).toContain('Access denied');
    });

    it('GET /api/v1/test-guard/campaigns-create - should allow user with campaigns:create permission', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-guard/campaigns-create')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/test-guard/campaigns-create - should block ANALYST missing campaigns:create (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-guard/campaigns-create')
        .set('Authorization', `Bearer ${analystToken}`)
        .expect(403);

      expect(res.body.message).toContain('Access denied');
    });
  });
});
