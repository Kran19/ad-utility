import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditContext {
  actorUserId?: string;
  actorEmail?: string;
  actorIp?: string;
}

export interface CreateAuditLogParams {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorIp?: string | null;
  details?: Record<string, any> | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: CreateAuditLogParams, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorUserId: params.actorUserId,
        actorEmail: params.actorEmail,
        actorIp: params.actorIp,
        details: params.details || {},
      },
    });
  }
}
