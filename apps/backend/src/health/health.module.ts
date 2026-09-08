import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AdsModule } from '../ads/ads.module';

@Module({
  imports: [AdsModule],
  controllers: [HealthController],
})
export class HealthModule {}
