import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdDeliveryService } from './services/ad-delivery.service';
import { AdSelectorService } from './services/ad-selector.service';
import { DeviceDetectorService } from './services/device-detector.service';
import { TrackingTokenService } from './services/tracking-token.service';
import { RedisAdCacheService } from './services/redis-ad-cache.service';
import { MockExternalAdProviderService } from './providers/mock-external-ad-provider.service';
import { ExternalAdNetworkService } from './providers/external-ad-network.service';
import { AdRevenueSyncService } from './providers/ad-revenue-sync.service';
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
    MockExternalAdProviderService,
    ExternalAdNetworkService,
    AdRevenueSyncService,
  ],
  exports: [
    AdDeliveryService,
    AdSelectorService,
    RedisAdCacheService,
    ExternalAdNetworkService,
    AdRevenueSyncService,
    MockExternalAdProviderService,
  ],
})
export class AdsModule {}
