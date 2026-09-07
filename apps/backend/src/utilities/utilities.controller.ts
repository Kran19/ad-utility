import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { UtilitiesService } from './utilities.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiEnvelope,
  UtilityPublicDto,
  UtilityExecutionResponseDto,
} from '@ad-utility/shared';

@ApiTags('Utilities')
@Controller('utilities')
@UseGuards(JwtAuthGuard)
export class UtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all published and active utilities' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter utilities by category slug' })
  @ApiResponse({ status: 200, description: 'List of active utilities' })
  async listUtilities(
    @Query('category') categorySlug?: string,
  ): Promise<ApiEnvelope<UtilityPublicDto[]>> {
    const data = await this.utilitiesService.listPublicUtilities(categorySlug);
    return {
      success: true,
      data,
      meta: {
        total: data.length,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get public metadata, SEO info, and FAQ content for a utility' })
  @ApiParam({ name: 'slug', description: 'Utility slug identifier (e.g. json-formatter, jpg-to-png)' })
  @ApiResponse({ status: 200, description: 'Utility public metadata' })
  @ApiResponse({ status: 404, description: 'Utility not found or disabled' })
  async getUtilityBySlug(@Param('slug') slug: string): Promise<ApiEnvelope<UtilityPublicDto>> {
    const data = await this.utilitiesService.getPublicUtility(slug);
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Post(':slug/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a utility with input data' })
  @ApiParam({ name: 'slug', description: 'Utility slug identifier' })
  @ApiResponse({ status: 200, description: 'Execution result' })
  @ApiResponse({ status: 400, description: 'Validation or execution failure' })
  @ApiResponse({ status: 404, description: 'Utility not found' })
  @ApiResponse({ status: 408, description: 'Execution timeout' })
  @ApiResponse({ status: 503, description: 'Execution adapter unavailable' })
  async execute(
    @Param('slug') slug: string,
    @Body() body: any,
    @Req() req: Request,
  ): Promise<ApiEnvelope<UtilityExecutionResponseDto>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const sessionToken = (req.headers['x-session-token'] as string) || req.cookies?.sessionToken;

    // Support both wrapped payload { input: ... } and direct body
    const rawInput = body && typeof body === 'object' && 'input' in body ? body.input : body;

    const result = await this.utilitiesService.executeUtility(slug, rawInput, ip, userAgent, sessionToken);

    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
