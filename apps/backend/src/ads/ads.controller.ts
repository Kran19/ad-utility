import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AdDeliveryService } from './services/ad-delivery.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiEnvelope,
  AdSlotRequestDto,
  AdSlotResponseDto,
  AdImpressionRequestDto,
  AdClickRequestDto,
  AdClickResponseDto,
} from '@ad-utility/shared';

@ApiTags('Ads')
@Controller('ads')
@UseGuards(JwtAuthGuard)
export class AdsController {
  constructor(private readonly adDeliveryService: AdDeliveryService) {}

  @Public()
  @Post('slot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request an ad creative for a specific placement and utility' })
  @ApiResponse({ status: 200, description: 'Ad slot selection result (hasAd: true/false)' })
  async getAdSlot(
    @Body() body: AdSlotRequestDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<AdSlotResponseDto>> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const countryHint = (req.headers['cf-ipcountry'] || req.headers['x-country-code']) as string;

    const data = await this.adDeliveryService.getAdForSlot(body, userAgent, ip, countryHint);

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Post('impression')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record an ad impression' })
  @ApiResponse({ status: 200, description: 'Impression recorded' })
  async recordImpression(
    @Body() body: AdImpressionRequestDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<{ recorded: boolean }>> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const result = await this.adDeliveryService.recordImpression(body, ip, userAgent);

    return {
      success: true,
      data: { recorded: result.recorded },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Post('click')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record an ad click and obtain destination URL' })
  @ApiResponse({ status: 200, description: 'Click recorded with destination redirect URL' })
  async recordClick(
    @Body() body: AdClickRequestDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<AdClickResponseDto>> {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const data = await this.adDeliveryService.recordClick(body, ip);

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
