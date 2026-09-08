import {
  Controller,
  Get,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisAdCacheService } from '../ads/services/redis-ad-cache.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisCache?: RedisAdCacheService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'System Health Check (Compatibility Endpoint)' })
  check() {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'ad-utility-backend',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      },
    };
  }

  @Public()
  @Get('liveness')
  @ApiOperation({ summary: 'Liveness Probe (Process Vitality)' })
  @ApiResponse({ status: 200, description: 'Process is alive and responding' })
  liveness() {
    return {
      success: true,
      data: {
        status: 'alive',
        service: 'ad-utility-backend',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Get('readiness')
  @ApiOperation({ summary: 'Readiness Probe (Infrastructure Readiness)' })
  @ApiResponse({ status: 200, description: 'Service is ready to handle traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready (database unreachable)' })
  async readiness() {
    // 1. Mandatory PostgreSQL Database Check (FAIL-CLOSED)
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      throw new ServiceUnavailableException('Database connection failed');
    }

    // 2. Non-blocking Redis Check (FAIL-OPEN)
    const redisAvailable = this.redisCache ? this.redisCache.isAvailable() : true;
    const redisStatus = redisAvailable ? 'connected' : 'degraded';

    return {
      success: true,
      data: {
        status: 'ready',
        service: 'ad-utility-backend',
        database: 'connected',
        redis: redisStatus,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
