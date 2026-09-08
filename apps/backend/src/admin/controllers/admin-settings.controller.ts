import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminSettingsService } from '../services/admin-settings.service';
import { AdminUpdateSettingDto } from '../dto/admin-settings.dto';
import { ApiResponse, JwtPayload } from '@ad-utility/shared';
import { Request } from 'express';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  @RequirePermissions('settings:read')
  async listSettings(): Promise<ApiResponse<any>> {
    const data = await this.settingsService.listSettings();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':key')
  @RequirePermissions('settings:update')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: AdminUpdateSettingDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.settingsService.updateSetting(key, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
