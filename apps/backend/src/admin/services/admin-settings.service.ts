import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AdminUpdateSettingDto } from '../dto/admin-settings.dto';
import { AdminSettingDto, JwtPayload } from '@ad-utility/shared';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listSettings(): Promise<AdminSettingDto[]> {
    const settings = await this.prisma.setting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return settings.map((s) => {
      let safeValue = s.value as Record<string, any>;
      if (s.isEncrypted || s.key.toLowerCase().includes('secret') || s.key.toLowerCase().includes('key') || s.key.toLowerCase().includes('password')) {
        safeValue = { masked: '••••••••••••••••' };
      }
      return {
        key: s.key,
        value: safeValue,
        category: s.category,
        description: s.description,
        isEncrypted: s.isEncrypted,
        updatedAt: s.updatedAt.toISOString(),
      };
    });
  }

  async updateSetting(key: string, dto: AdminUpdateSettingDto, currentUser: JwtPayload, ip?: string): Promise<AdminSettingDto> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.setting.update({
        where: { key },
        data: {
          value: dto.value,
        },
      });

      await this.auditService.record(
        {
          action: 'SETTING_UPDATED',
          entityType: 'Setting',
          entityId: key,
          actorUserId: currentUser.sub,
          actorEmail: currentUser.email,
          actorIp: ip,
          details: { key, updatedValue: setting.isEncrypted ? '[MASKED]' : dto.value },
        },
        tx,
      );

      let safeValue = updated.value as Record<string, any>;
      if (updated.isEncrypted || updated.key.toLowerCase().includes('secret') || updated.key.toLowerCase().includes('key')) {
        safeValue = { masked: '••••••••••••••••' };
      }

      return {
        key: updated.key,
        value: safeValue,
        category: updated.category,
        description: updated.description,
        isEncrypted: updated.isEncrypted,
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }
}
