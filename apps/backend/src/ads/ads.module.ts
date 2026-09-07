import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdDeliveryService } from './services/ad-delivery.service';
import { AdSelectorService } from './services/ad-selector.service';
import { DeviceDetectorService } from './services/device-detector.service';
import { TrackingTokenService } from './services/tracking-token.service';
import { RedisAdCacheService } from './services/redis-ad-cache.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdsController],
  providers: [
    AdDeliveryService,
    AdSelectorService,
    DeviceDetectorService,
    TrackingTokenService,
    RedisAdCacheService,
  ],
  exports: [AdDeliveryService, RedisAdCacheService],
})
export class AdsModule {}
