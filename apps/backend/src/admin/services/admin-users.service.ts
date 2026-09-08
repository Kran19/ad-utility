import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import { AdminCreateUserDto, AdminUpdateUserDto } from '../dto/admin-users.dto';
import { PaginatedResult, AdminUserDto, AdminRoleDto, JwtPayload } from '@ad-utility/shared';
import { RoleType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(query: AdminPaginationQueryDto): Promise<PaginatedResult<AdminUserDto>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: query.sortOrder || 'desc' },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      }),
    ]);

    const items: AdminUserDto[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      roles: u.userRoles.map((ur) => ur.role.name as RoleType),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        auditLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles: user.userRoles.map((ur) => ur.role.name),
      recentAuditLogs: user.auditLogs,
    };
  }

  async createUser(dto: AdminCreateUserDto, currentUser: JwtPayload, ip?: string): Promise<AdminUserDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException(`Email "${dto.email}" is already in use`);
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN accounts
    if (dto.roles.includes(RoleType.SUPER_ADMIN) && !currentUser.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: true,
        },
      });

      const dbRoles = await tx.role.findMany({
        where: { name: { in: dto.roles } },
      });

      for (const role of dbRoles) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }

      await this.auditService.record(
        {
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: user.id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { email: user.email, roles: dto.roles },
        },
        tx,
      );

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lastLoginAt: null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        roles: dto.roles,
      };
    });
  }

  async updateUser(id: string, dto: AdminUpdateUserDto, currentUser: JwtPayload, ip?: string): Promise<AdminUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (dto.roles && dto.roles.includes(RoleType.SUPER_ADMIN) && !currentUser.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }

    return this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {};
      if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
      if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.password) {
        updateData.passwordHash = await bcrypt.hash(dto.password, 10);
      }

      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
      });

      if (dto.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        const dbRoles = await tx.role.findMany({
          where: { name: { in: dto.roles } },
        });

        for (const role of dbRoles) {
          await tx.userRole.create({
            data: {
              userId: id,
              roleId: role.id,
            },
          });
        }
      }

      const finalRoles = dto.roles || user.userRoles.map((ur) => ur.role.name as RoleType);

      await this.auditService.record(
        {
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: {
            changes: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              isActive: dto.isActive,
              roles: dto.roles,
            },
          },
        },
        tx,
      );

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isActive: updatedUser.isActive,
        lastLoginAt: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString() : null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
        roles: finalRoles,
      };
    });
  }

  async listRoles(): Promise<AdminRoleDto[]> {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name as RoleType,
      description: r.description,
      permissions: r.rolePermissions.map((rp) => rp.permission.action),
    }));
  }
}
