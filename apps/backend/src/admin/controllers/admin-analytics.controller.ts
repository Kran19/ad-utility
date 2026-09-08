import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { GrowthIntelligenceService } from '../services/growth-intelligence.service';
import { MonetizationIntelligenceService } from '../services/monetization-intelligence.service';
import { BusinessIntelligenceService } from '../services/business-intelligence.service';
import { JourneyIntelligenceService } from '../services/journey-intelligence.service';
import { SeoIntelligenceService } from '../services/seo-intelligence.service';
import {
  ApiResponse,
  GrowthIntelligenceDto,
  ExperimentDto,
  MonetizationIntelligenceDto,
  MonetizationRecommendationDto,
  BusinessIntelligenceDto,
  OptimizationOpportunityDto,
  JourneyIntelligenceDto,
  JourneyOpportunityDto,
  SeoIntelligenceDto,
  SeoOpportunityDto,
  SeoPageHealthDto,
  SeoInternalLinkOpportunityDto,
  SeoContentCoverageDto,
} from '@ad-utility/shared';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly analyticsService: AdminAnalyticsService,
    private readonly growthService: GrowthIntelligenceService,
    private readonly monetizationService: MonetizationIntelligenceService,
    private readonly businessIntelligenceService: BusinessIntelligenceService,
    private readonly journeyIntelligenceService: JourneyIntelligenceService,
    private readonly seoIntelligenceService: SeoIntelligenceService,
  ) {}

  @Get('overview')
  @RequirePermissions('analytics:read')
  async getOverview(@Query('days') days?: string): Promise<ApiResponse<any>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.analyticsService.getOverview(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('growth')
  @RequirePermissions('analytics:read')
  async getGrowthIntelligence(@Query('days') days?: string): Promise<ApiResponse<GrowthIntelligenceDto>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.growthService.getGrowthIntelligence(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('monetization')
  @RequirePermissions('analytics:read')
  async getMonetizationIntelligence(
    @Query('days') days?: string,
  ): Promise<ApiResponse<MonetizationIntelligenceDto>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.monetizationService.getMonetizationIntelligence(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('monetization/recommendations')
  @RequirePermissions('analytics:read')
  async getMonetizationRecommendations(
    @Query('days') days?: string,
  ): Promise<ApiResponse<MonetizationRecommendationDto[]>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.monetizationService.getRecommendations(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('business-intelligence')
  @RequirePermissions('analytics:read')
  async getBusinessIntelligence(
    @Query('days') days?: string,
  ): Promise<ApiResponse<BusinessIntelligenceDto>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.businessIntelligenceService.getBusinessIntelligence(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('business-intelligence/opportunities')
  @RequirePermissions('analytics:read')
  async getOptimizationOpportunities(
    @Query('days') days?: string,
  ): Promise<ApiResponse<OptimizationOpportunityDto[]>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.businessIntelligenceService.getOpportunities(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('journey')
  @RequirePermissions('analytics:read')
  async getJourneyIntelligence(
    @Query('days') days?: string,
  ): Promise<ApiResponse<JourneyIntelligenceDto>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.journeyIntelligenceService.getJourneyIntelligence(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('journey/opportunities')
  @RequirePermissions('analytics:read')
  async getJourneyOpportunities(
    @Query('days') days?: string,
  ): Promise<ApiResponse<JourneyOpportunityDto[]>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.journeyIntelligenceService.getOpportunities(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('seo')
  @RequirePermissions('analytics:read')
  async getSeoIntelligence(
    @Query('days') days?: string,
  ): Promise<ApiResponse<SeoIntelligenceDto>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.seoIntelligenceService.getSeoIntelligence(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('seo/opportunities')
  @RequirePermissions('analytics:read')
  async getSeoOpportunities(
    @Query('days') days?: string,
  ): Promise<ApiResponse<SeoOpportunityDto[]>> {
    const period = days ? parseInt(days, 10) || 30 : 30;
    const data = await this.seoIntelligenceService.getOpportunities(period);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('seo/page-health')
  @RequirePermissions('analytics:read')
  async getSeoPageHealth(): Promise<ApiResponse<SeoPageHealthDto[]>> {
    const data = await this.seoIntelligenceService.getPageHealthList();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('seo/internal-links')
  @RequirePermissions('analytics:read')
  async getSeoInternalLinks(): Promise<ApiResponse<SeoInternalLinkOpportunityDto[]>> {
    const data = await this.seoIntelligenceService.getInternalLinkOpportunities();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('seo/content-coverage')
  @RequirePermissions('analytics:read')
  async getSeoContentCoverage(): Promise<ApiResponse<SeoContentCoverageDto>> {
    const data = await this.seoIntelligenceService.getContentCoverage();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('experiments')
  @RequirePermissions('analytics:read')
  async getExperiments(): Promise<ApiResponse<ExperimentDto[]>> {
    const data = this.growthService.getRegisteredExperiments();
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}



