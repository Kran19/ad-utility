import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { BillingService } from '../services/billing.service';
import {
  ApiEnvelope,
  AdminBillingOverviewDto,
  AdminPlanUpdateDto,
  PlanDto,
  BillingEventDto,
} from '@ad-utility/shared';

@ApiTags('Admin Billing & Subscriptions')
@Controller('admin/billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AdminBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('overview')
  @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'Admin Billing Overview with Revenue Truth & Provider Health' })
  @ApiResponse({ status: 200, description: 'Admin billing metrics' })
  async getOverview(): Promise<ApiEnvelope<AdminBillingOverviewDto>> {
    const data = await this.billingService.getAdminOverview();
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('subscriptions')
  @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'List customer subscriptions' })
  @ApiResponse({ status: 200, description: 'Subscriptions list' })
  async getSubscriptions(
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ): Promise<ApiEnvelope<any>> {
    const data = await this.billingService.getAdminSubscriptions(
      status,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('plans')
  @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'List all plans for admin management' })
  @ApiResponse({ status: 200, description: 'All plans' })
  async getPlans(): Promise<ApiEnvelope<PlanDto[]>> {
    const data = await this.billingService.getAdminPlans();
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Patch('plans/:id')
  @RequirePermissions('billing:manage')
  @ApiOperation({ summary: 'Update plan metadata, entitlements, or usage limits' })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: AdminPlanUpdateDto,
  ): Promise<ApiEnvelope<PlanDto>> {
    const data = await this.billingService.updatePlan(id, dto);
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('events')
  @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'Webhook and billing events audit log' })
  @ApiResponse({ status: 200, description: 'Billing events log' })
  async getEvents(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ): Promise<ApiEnvelope<any>> {
    const data = await this.billingService.getAdminBillingEvents(
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
