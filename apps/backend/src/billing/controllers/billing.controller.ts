import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from '../services/billing.service';
import { EntitlementService } from '../services/entitlement.service';
import { Public } from '../../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiEnvelope,
  CreateCheckoutSessionDto,
  CheckoutSessionResponseDto,
  CreatePortalSessionDto,
  PortalSessionResponseDto,
  UserBillingOverviewDto,
  UserUsageRecordDto,
  PlanDto,
} from '@ad-utility/shared';

@ApiTags('Billing & Subscriptions')
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List all public active subscription plans' })
  @ApiResponse({ status: 200, description: 'Active plans' })
  async getPlans(): Promise<ApiEnvelope<PlanDto[]>> {
    const data = await this.billingService.getPublicPlans();
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create checkout session for plan upgrade' })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
  async createCheckout(
    @Req() req: any,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<ApiEnvelope<CheckoutSessionResponseDto>> {
    const userId = req.user.id || req.user.sub;
    const data = await this.billingService.createCheckoutSession(userId, dto);
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post('portal')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create customer billing management portal session' })
  @ApiResponse({ status: 200, description: 'Portal session URL' })
  async createPortal(
    @Req() req: any,
    @Body() dto: CreatePortalSessionDto,
  ): Promise<ApiEnvelope<PortalSessionResponseDto>> {
    const userId = req.user.id || req.user.sub;
    const data = await this.billingService.createPortalSession(userId, dto);
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('subscription/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription and entitlement status' })
  @ApiResponse({ status: 200, description: 'User billing overview' })
  async getMySubscription(@Req() req: any): Promise<ApiEnvelope<UserBillingOverviewDto>> {
    const userId = req.user.id || req.user.sub;
    const data = await this.billingService.getUserBillingOverview(userId);
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('usage/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user daily usage metrics' })
  @ApiResponse({ status: 200, description: 'Daily usage breakdown' })
  async getMyUsage(@Req() req: any): Promise<ApiEnvelope<UserUsageRecordDto[]>> {
    const userId = req.user.id || req.user.sub;
    const data = await this.entitlementService.getUserUsageOverview(userId);
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post('cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel current subscription at period end' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancelSubscription(
    @Req() req: any,
    @Body() body: { atPeriodEnd?: boolean },
  ): Promise<ApiEnvelope<{ success: boolean; cancelAtPeriodEnd: boolean }>> {
    const userId = req.user.id || req.user.sub;
    const data = await this.billingService.cancelSubscription(
      userId,
      body?.atPeriodEnd ?? true,
    );
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authoritative payment provider webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged' })
  async handleWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') stripeSignature?: string,
    @Headers('x-mock-signature') mockSignature?: string,
  ): Promise<ApiEnvelope<{ eventId: string; status: string }>> {
    const signature = stripeSignature || mockSignature;
    const result = await this.billingService.processWebhook(payload, signature);
    return {
      success: true,
      data: {
        eventId: result.eventId,
        status: result.status,
      },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
