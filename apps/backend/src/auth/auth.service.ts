import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthUserProfile,
  AuthResponseData,
  JwtPayload,
  RoleType,
} from '@ad-utility/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'super_secret_jwt_key_change_in_production_min_32_chars',
    );
    this.jwtRefreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'super_secret_refresh_key_change_in_production',
    );
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    this.jwtRefreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
  }

  /**
   * Helper to format User entity into AuthUserProfile
   */
  private formatUserProfile(user: any): AuthUserProfile {
    const roles: RoleType[] = (user.userRoles || []).map((ur: any) => ur.role.name as RoleType);

    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles || []) {
      for (const rp of ur.role.rolePermissions || []) {
        if (rp.permission?.action) {
          permissionsSet.add(rp.permission.action);
        }
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles,
      permissions: Array.from(permissionsSet),
      createdAt: user.createdAt,
    };
  }

  /**
   * Register a new user with secure password hashing and default non-admin role
   */
  async register(
    registerDto: RegisterDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseData> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      this.logger.warn(
        `Registration attempt with already existing email: ${normalizedEmail} from IP: ${ip || 'unknown'}`,
      );
      throw new ConflictException(
        'An account with this email already exists. Try logging in instead.',
      );
    }

    // Parse name if provided
    let firstName = registerDto.firstName?.trim() || null;
    let lastName = registerDto.lastName?.trim() || null;

    if (registerDto.name && !firstName) {
      const parts = registerDto.name.trim().split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // Create user (strictly no admin roles assigned to prevent privilege escalation)
    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        isActive: true,
        lastLoginAt: new Date(),
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Record auditable registration event
    await this.prisma.auditLog.create({
      data: {
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: newUser.id,
        actorUserId: newUser.id,
        actorEmail: newUser.email,
        actorIp: ip,
        details: {
          userAgent,
          termsAccepted: !!registerDto.termsAccepted,
        },
      },
    });

    const userProfile = this.formatUserProfile(newUser);

    const payload: JwtPayload = {
      sub: userProfile.id,
      email: userProfile.email,
      roles: userProfile.roles,
      permissions: userProfile.permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { sub: userProfile.id, email: userProfile.email },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: userProfile,
    };
  }

  /**
   * Validate user credentials
   */
  async validateUser(
    email: string,
    pass: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`Failed login attempt for non-existent email: ${email} from IP: ${ip || 'unknown'}`);
      await this.prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entityType: 'User',
          actorEmail: email,
          actorIp: ip,
          details: { reason: 'User not found', userAgent },
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      this.logger.warn(`Login attempt for inactive user: ${email}`);
      await this.prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: user.id,
          actorUserId: user.id,
          actorEmail: user.email,
          actorIp: ip,
          details: { reason: 'Account disabled', userAgent },
        },
      });
      throw new ForbiddenException('Account has been deactivated. Please contact an administrator.');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      this.logger.warn(`Failed login attempt (invalid password) for user: ${email} from IP: ${ip || 'unknown'}`);
      await this.prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: user.id,
          actorUserId: user.id,
          actorEmail: user.email,
          actorIp: ip,
          details: { reason: 'Password mismatch', userAgent },
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.formatUserProfile(user);
  }

  /**
   * Log in user and generate access & refresh tokens
   */
  async login(loginDto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResponseData> {
    const userProfile = await this.validateUser(loginDto.email, loginDto.password, ip, userAgent);

    const payload: JwtPayload = {
      sub: userProfile.id,
      email: userProfile.email,
      roles: userProfile.roles,
      permissions: userProfile.permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { sub: userProfile.id, email: userProfile.email },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn,
      },
    );

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: userProfile.id },
      data: { lastLoginAt: new Date() },
    });

    // Record login success audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'LOGIN_SUCCESS',
        entityType: 'User',
        entityId: userProfile.id,
        actorUserId: userProfile.id,
        actorEmail: userProfile.email,
        actorIp: ip,
        details: { userAgent },
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: userProfile,
    };
  }

  /**
   * Refresh access token using a valid refresh token
   */
  async refreshToken(
    refreshTokenStr: string,
    ip?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(refreshTokenStr, {
        secret: this.jwtRefreshSecret,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account no longer active or valid');
    }

    const userProfile = this.formatUserProfile(user);

    const payload: JwtPayload = {
      sub: userProfile.id,
      email: userProfile.email,
      roles: userProfile.roles,
      permissions: userProfile.permissions,
    };

    const newAccessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn,
    });

    const newRefreshToken = this.jwtService.sign(
      { sub: userProfile.id, email: userProfile.email },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn,
      },
    );

    await this.prisma.auditLog.create({
      data: {
        action: 'TOKEN_REFRESH',
        entityType: 'User',
        entityId: userProfile.id,
        actorUserId: userProfile.id,
        actorEmail: userProfile.email,
        actorIp: ip,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Get authenticated user profile
   */
  async getProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.formatUserProfile(user);
  }
}
