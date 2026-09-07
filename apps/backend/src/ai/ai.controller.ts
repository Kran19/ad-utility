import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AiGatewayService } from './services/ai-gateway.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApiEnvelope,
  AiGenerateRequestDto,
  AiGenerateResponseDto,
  AiUsageSummaryDto,
} from '@ad-utility/shared';
import { RoleType } from '@prisma/client';

@ApiTags('AI Gateway')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(
    private readonly aiGatewayService: AiGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate text or summary via centralized AI Gateway' })
  @ApiResponse({ status: 200, description: 'AI generation completed' })
  async generateText(
    @Body() body: AiGenerateRequestDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<AiGenerateResponseDto>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const data = await this.aiGatewayService.generateText(body, ip);

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('usage')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get total AI usage telemetry metrics' })
  @ApiResponse({ status: 200, description: 'AI usage metrics summary' })
  async getUsageSummary(): Promise<ApiEnvelope<AiUsageSummaryDto>> {
    const totalRequests = await this.prisma.aiRequest.count();
    const successRequests = await this.prisma.aiRequest.count({ where: { status: 'SUCCESS' } });

    const aggregate = await this.prisma.aiRequest.aggregate({
      _sum: {
        totalTokens: true,
        estimatedCostUsd: true,
      },
    });

    const totalTokens = aggregate._sum.totalTokens || 0;
    const totalCostUsd = aggregate._sum.estimatedCostUsd || 0;
    const successRate = totalRequests > 0 ? parseFloat(((successRequests / totalRequests) * 100).toFixed(1)) : 100;

    return {
      success: true,
      data: {
        totalRequests,
        totalTokens,
        totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
        successRate,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
