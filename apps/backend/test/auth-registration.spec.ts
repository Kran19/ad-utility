import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import { JwtPayload } from '@ad-utility/shared';

@Controller('test-registration-guard')
@UseGuards(JwtAuthGuard, RolesGuard)
class TestRegistrationGuardController {
  @Get('admin-only')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminOnly() {
    return { success: true, message: 'Welcome Admin' };
  }

  @Get('user-profile')
  userProfile(@CurrentUser() user: JwtPayload) {
    return { success: true, user };
  }
}

jest.setTimeout(30000);

describe('Phase 29: User Account Registration & Identity Security', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;

  const testEmail = `newuser_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  let createdUserId: string;
  let userAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestRegistrationGuardController],
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
  });

  afterAll(async () => {
    // Clean up created user and audit logs
    if (createdUserId) {
      await prisma.auditLog.deleteMany({ where: { actorUserId: createdUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    await app.close();
  });

  describe('1. Registration Endpoint Validation & Security', () => {
    it('should successfully register a new user and set HTTP-only cookies without credit fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: `  ${testEmail.toUpperCase()}  `,
          password: testPassword,
          termsAccepted: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.user.firstName).toBe('Jane');
      expect(res.body.data.user.lastName).toBe('Doe');
      expect(res.body.data.user.roles).toEqual([]); // Non-admin, no elevated roles
      expect(res.body.data.user.credits).toBeUndefined(); // Zero credits in Phase 29

      // Check cookies
      const cookies = (res.header['set-cookie'] || []) as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('accessToken=') && c.includes('HttpOnly'))).toBe(true);
      expect(cookies.some((c: string) => c.includes('refreshToken=') && c.includes('HttpOnly'))).toBe(true);

      createdUserId = res.body.data.user.id;
      userAccessToken = res.body.data.accessToken;
    });

    it('should reject duplicate email registration with 409 Conflict and friendly message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe Clone',
          email: testEmail.toLowerCase(),
          password: 'AnotherPassword123!',
        })
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });

    it('should reject registration with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: testPassword,
        })
        .expect(400);
    });

    it('should reject registration with weak/short password (< 8 chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Short Password',
          email: `short_${Date.now()}@example.com`,
          password: '123',
        })
        .expect(400);
    });

    it('should never expose password or passwordHash in API response', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Privacy User',
          email: `privacy_${Date.now()}@example.com`,
          password: testPassword,
        })
        .expect(201);

      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Clean up
      await prisma.user.delete({ where: { id: res.body.data.user.id } }).catch(() => {});
    });
  });

  describe('2. Password Hashing & Database Verification', () => {
    it('should securely hash password with bcrypt in PostgreSQL', async () => {
      const user = await prisma.user.findUnique({
        where: { id: createdUserId },
      });

      expect(user).toBeDefined();
      expect(user!.passwordHash).not.toBe(testPassword);
      expect(user!.passwordHash.startsWith('$2')).toBe(true);

      const isMatch = await bcrypt.compare(testPassword, user!.passwordHash);
      expect(isMatch).toBe(true);
    });
  });

  describe('3. Strict Privilege Escalation Prevention & RBAC', () => {
    it('should strictly ignore role payload injection (SUPER_ADMIN) and create standard user', async () => {
      const escalationEmail = `escalation_${Date.now()}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Attacker Attempt',
          email: escalationEmail,
          password: testPassword,
          role: 'SUPER_ADMIN',
        })
        .expect(400); // ValidationPipe rejects non-whitelisted property 'role'

      // Clean up if any
      await prisma.user.deleteMany({ where: { email: escalationEmail } }).catch(() => {});
    });

    it('should strictly deny newly registered user from admin-only endpoints (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-registration-guard/admin-only')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);
    });

    it('should allow newly registered user to access authenticated profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdUserId);
      expect(res.body.data.roles).toEqual([]);
      expect(res.body.data.credits).toBeUndefined();
    });
  });

  describe('4. Audit Logging', () => {
    it('should create an auditable USER_REGISTERED entry without fake credits', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: createdUserId,
          action: 'USER_REGISTERED',
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe('USER_REGISTERED');
      expect((auditLog!.details as any).initialCreditGrant).toBeUndefined();
    });
  });

  describe('5. Login & Session Flow', () => {
    it('should successfully authenticate newly registered user via /auth/login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.id).toBe(createdUserId);
    });

    it('should reject login with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword999!',
        })
        .expect(401);
    });
  });
});
