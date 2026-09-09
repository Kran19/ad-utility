import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAdsService } from '../services/admin-ads.service';
import { AdminPaginationQueryDto } from '../dto/admin-query.dto';
import {
  AdminCreateCampaignDto,
  AdminUpdateCampaignDto,
  AdminCreateCreativeDto,
  AdminUpdateCreativeDto,
  AdminUpdatePlacementDto,
  AdminCreateTargetingRuleDto,
  AdminUpdateTargetingRuleDto,
  AdminCreateScheduleDto,
  AdminUpdateScheduleDto,
  AdminAdPreviewRequestDto,
  AdminAdMatrixQueryDto,
  AdminListTargetingRulesQueryDto,
} from '../dto/admin-ads.dto';
import {
  ApiResponse,
  JwtPayload,
  ProviderHealthDto,
  MonetizationSyncRequestDto,
  MonetizationSyncResponseDto,
} from '@ad-utility/shared';
import { CampaignStatus, CreativeType } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ExternalAdNetworkService } from '../../ads/providers/external-ad-network.service';
import { AdRevenueSyncService } from '../../ads/providers/ad-revenue-sync.service';

@Controller('admin/ads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminAdsController {
  constructor(
    private readonly adsService: AdminAdsService,
    private readonly prisma: PrismaService,
    private readonly adNetworkService: ExternalAdNetworkService,
    private readonly revenueSyncService: AdRevenueSyncService,
  ) {}

  // -------------------------------------------------------------
  // CAMPAIGNS
  // -------------------------------------------------------------
  @Get('campaigns')
  @RequirePermissions('campaigns:read')
  async listCampaigns(
    @Query() query: AdminPaginationQueryDto & { status?: CampaignStatus },
  ): Promise<ApiResponse<any>> {
    const data = await this.adsService.listCampaigns(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('campaigns/:id')
  @RequirePermissions('campaigns:read')
  async getCampaignById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const data = await this.adsService.getCampaignById(id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post('campaigns')
  @RequirePermissions('campaigns:create')
  async createCampaign(
    @Body() dto: AdminCreateCampaignDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.createCampaign(dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch('campaigns/:id')
  @RequirePermissions('campaigns:update')
  async updateCampaign(
    @Param('id') id: string,
    @Body() dto: AdminUpdateCampaignDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.updateCampaign(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete('campaigns/:id')
  @RequirePermissions('campaigns:delete')
  async deleteCampaign(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.deleteCampaign(id, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------
  // CREATIVES
  // -------------------------------------------------------------
  @Get('creatives')
  @RequirePermissions('creatives:read')
  async listCreatives(
    @Query() query: AdminPaginationQueryDto & { type?: CreativeType },
  ): Promise<ApiResponse<any>> {
    const data = await this.adsService.listCreatives(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('creatives/:id')
  @RequirePermissions('creatives:read')
  async getCreativeById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const data = await this.adsService.getCreativeById(id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post('creatives')
  @RequirePermissions('creatives:create')
  async createCreative(
    @Body() dto: AdminCreateCreativeDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.createCreative(dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch('creatives/:id')
  @RequirePermissions('creatives:update')
  async updateCreative(
    @Param('id') id: string,
    @Body() dto: AdminUpdateCreativeDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.updateCreative(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete('creatives/:id')
  @RequirePermissions('creatives:delete')
  async deleteCreative(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.deleteCreative(id, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------
  // PLACEMENTS
  // -------------------------------------------------------------
  @Get('placements')
  @RequirePermissions('placements:read')
  async listPlacements(): Promise<ApiResponse<any>> {
    const data = await this.adsService.listPlacements();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch('placements/:id')
  @RequirePermissions('placements:update')
  async updatePlacement(
    @Param('id') id: string,
    @Body() dto: AdminUpdatePlacementDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.updatePlacement(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------
  // AD OPERATIONS & PREVIEW
  // -------------------------------------------------------------
  @Get('manager/matrix')
  @RequirePermissions('campaigns:read')
  async getAdMatrix(
    @Query() query: AdminAdMatrixQueryDto,
  ): Promise<ApiResponse<any>> {
    const data = await this.adsService.getAdMatrix(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post('preview')
  @RequirePermissions('campaigns:read')
  async previewAd(
    @Body() dto: AdminAdPreviewRequestDto,
  ): Promise<ApiResponse<any>> {
    const data = await this.adsService.previewAd(dto);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------
  // TARGETING RULES
  // -------------------------------------------------------------
  @Get('targeting')
  @RequirePermissions('targeting:manage')
  async listTargetingRules(
    @Query() query: AdminListTargetingRulesQueryDto,
  ): Promise<ApiResponse<any>> {
    const data = await this.adsService.listTargetingRules(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post('targeting')
  @RequirePermissions('targeting:manage')
  async createTargetingRule(
    @Body() dto: AdminCreateTargetingRuleDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.createTargetingRule(dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch('targeting/:id')
  @RequirePermissions('targeting:manage')
  async updateTargetingRule(
    @Param('id') id: string,
    @Body() dto: AdminUpdateTargetingRuleDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.updateTargetingRule(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete('targeting/:id')
  @RequirePermissions('targeting:manage')
  async deleteTargetingRule(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.deleteTargetingRule(id, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------
  // SCHEDULES
  // -------------------------------------------------------------
  @Get('schedules')
  @RequirePermissions('campaigns:read')
  async listSchedules(@Query() query: { campaignId?: string }): Promise<ApiResponse<any>> {
    const data = await this.adsService.listSchedules(query);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post('schedules')
  @RequirePermissions('campaigns:update')
  async createSchedule(
    @Body() dto: AdminCreateScheduleDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.createSchedule(dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch('schedules/:id')
  @RequirePermissions('campaigns:update')
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: AdminUpdateScheduleDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.updateSchedule(id, dto, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete('schedules/:id')
  @RequirePermissions('campaigns:update')
  async deleteSchedule(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await this.adsService.deleteSchedule(id, user, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------
  // PHASE 24: EXTERNAL PROVIDER & REVENUE
  // -------------------------------------------------------------
  @Get('provider/health')
  @RequirePermissions('campaigns:read')
  async getProviderHealth(): Promise<ApiResponse<ProviderHealthDto>> {
    const data = await this.adNetworkService.healthCheck();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post('provider/sync')
  @RequirePermissions('campaigns:update')
  async syncRevenue(
    @Body() dto: MonetizationSyncRequestDto,
  ): Promise<ApiResponse<MonetizationSyncResponseDto>> {
    const data = await this.revenueSyncService.syncRevenue(dto);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('revenue')
  @RequirePermissions('campaigns:read')
  async getRevenueRecords(
    @Query('days') days?: string,
  ): Promise<ApiResponse<any>> {
    const period = days ? Math.max(1, Math.min(parseInt(days, 10) || 30, 365)) : 30;
    const cutoff = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const records = await this.prisma.adRevenueRecord.findMany({
      where: { date: { gte: cutoff } },
      orderBy: { date: 'desc' },
      take: 100,
    });
    return { success: true, data: records, timestamp: new Date().toISOString() };
  }
}
