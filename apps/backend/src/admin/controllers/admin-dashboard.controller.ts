import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { ApiResponse } from '@ad-utility/shared';
import { RoleType } from '@prisma/client';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.EDITOR, RoleType.ANALYST)
  async getDashboard(): Promise<ApiResponse<any>> {
    const data = await this.dashboardService.getDashboardMetrics();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
