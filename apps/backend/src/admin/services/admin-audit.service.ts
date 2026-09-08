import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import { PaginatedResult, AdminAuditLogDto } from '@ad-utility/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(
    query: AdminPaginationQueryDto & { entityType?: string; action?: string; actorEmail?: string },
  ): Promise<PaginatedResult<AdminAuditLogDto>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = query.action;
    if (query.actorEmail) where.actorEmail = { contains: query.actorEmail, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { actorEmail: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items: AdminAuditLogDto[] = logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      actorUserId: l.actorUserId,
      actorEmail: l.actorEmail,
      actorIp: l.actorIp,
      details: l.details as any,
      createdAt: l.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
}
