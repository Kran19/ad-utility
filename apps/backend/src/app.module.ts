import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UtilitiesModule } from './utilities/utilities.module';
import { AdsModule } from './ads/ads.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { PersonalizationModule } from './personalization/personalization.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    UtilitiesModule,
    AdsModule,
    AiModule,
    AnalyticsModule,
    AdminModule,
    HealthModule,
    PersonalizationModule,
    BillingModule,
  ],
})
export class AppModule {}
