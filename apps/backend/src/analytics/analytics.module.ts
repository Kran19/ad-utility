import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsValidationService } from './services/analytics-validation.service';
import { AnalyticsDeduplicationService } from './services/analytics-deduplication.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsValidationService,
    AnalyticsDeduplicationService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
