import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './services/analytics.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ApiEnvelope,
  AnalyticsBatchIngestionDto,
  AnalyticsSummaryDto,
  AnalyticsQueryDto,
} from '@ad-utility/shared';
import { RoleType } from '@prisma/client';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest client telemetry events (single or batch)' })
  @ApiResponse({ status: 200, description: 'Events accepted' })
  async ingestEvents(
    @Body() body: any,
  ): Promise<ApiEnvelope<{ received: number; accepted: number; duplicates: number }>> {
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray(body?.events)
        ? body.events
        : [body];

    const result = await this.analyticsService.ingestEvents(rawList);

    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('summary')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregated platform telemetry metrics summary' })
  @ApiResponse({ status: 200, description: 'Analytics summary metrics' })
  async getSummary(
    @Query() query: AnalyticsQueryDto,
  ): Promise<ApiEnvelope<AnalyticsSummaryDto>> {
    const data = await this.analyticsService.getSummary(query);

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
