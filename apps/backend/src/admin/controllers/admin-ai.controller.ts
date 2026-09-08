import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { AdminAiService } from '../services/admin-ai.service';
import { ApiResponse } from '@ad-utility/shared';

@Controller('admin/ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminAiController {
  constructor(private readonly aiService: AdminAiService) {}

  @Get('overview')
  @RequirePermissions('ai:read')
  async getOverview(@Query('days') days?: string): Promise<ApiResponse<any>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.aiService.getOverview(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
