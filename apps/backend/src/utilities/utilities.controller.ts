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
  Header,
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
  CategoryPublicDto,
} from '@ad-utility/shared';

@ApiTags('Utilities')
@Controller('utilities')
@UseGuards(JwtAuthGuard)
export class UtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
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
  @Get('categories')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200')
  @ApiOperation({ summary: 'List all public utility categories' })
  @ApiResponse({ status: 200, description: 'List of public categories with active utility counts' })
  async listCategories(): Promise<ApiEnvelope<CategoryPublicDto[]>> {
    const data = await this.utilitiesService.listPublicCategories();
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
  @Get('categories/:categorySlug')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200')
  @ApiOperation({ summary: 'Get public category details and active utilities' })
  @ApiParam({ name: 'categorySlug', description: 'Category slug identifier' })
  @ApiResponse({ status: 200, description: 'Category detail' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryBySlug(
    @Param('categorySlug') categorySlug: string,
  ): Promise<ApiEnvelope<CategoryPublicDto>> {
    const data = await this.utilitiesService.getPublicCategory(categorySlug);
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
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
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req as any).id;

    // Support both wrapped payload { input: ... } and direct body
    const rawInput = body && typeof body === 'object' && 'input' in body ? body.input : body;
    const userId = (req as any).user?.id || (req as any).user?.sub;

    const result = await this.utilitiesService.executeUtility(
      slug,
      rawInput,
      ip,
      userAgent,
      sessionToken,
      requestId,
      userId,
    );

    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
