import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiGatewayService } from './services/ai-gateway.service';
import { AiRateLimiterService } from './services/ai-rate-limiter.service';
import { AiCostCalculatorService } from './services/ai-cost-calculator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdsModule } from '../ads/ads.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AdsModule, AuthModule],
  controllers: [AiController],
  providers: [AiGatewayService, AiRateLimiterService, AiCostCalculatorService],
  exports: [AiGatewayService],
})
export class AiModule {}
