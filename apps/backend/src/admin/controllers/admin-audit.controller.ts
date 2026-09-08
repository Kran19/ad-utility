import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { AdminAuditService } from '../services/admin-audit.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import { ApiResponse } from '@ad-utility/shared';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  async listAuditLogs(
    @Query() query: AdminPaginationQueryDto & { entityType?: string; action?: string; actorEmail?: string },
  ): Promise<ApiResponse<any>> {
    const data = await this.auditService.listAuditLogs(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
