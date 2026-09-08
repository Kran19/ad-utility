import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './services/audit.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUtilitiesService } from './services/admin-utilities.service';
import { AdminUtilitiesController } from './controllers/admin-utilities.controller';
import { AdminAdsService } from './services/admin-ads.service';
import { AdminAdsController } from './controllers/admin-ads.controller';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { GrowthIntelligenceService } from './services/growth-intelligence.service';
import { MonetizationIntelligenceService } from './services/monetization-intelligence.service';
import { BusinessIntelligenceService } from './services/business-intelligence.service';
import { JourneyIntelligenceService } from './services/journey-intelligence.service';
import { SeoIntelligenceService } from './services/seo-intelligence.service';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminAiService } from './services/admin-ai.service';
import { AdminAiController } from './controllers/admin-ai.controller';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminAuditController } from './controllers/admin-audit.controller';

import { UtilitiesModule } from '../utilities/utilities.module';
import { AdsModule } from '../ads/ads.module';

@Module({
  imports: [PrismaModule, UtilitiesModule, AdsModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminUtilitiesController,
    AdminAdsController,
    AdminAnalyticsController,
    AdminAiController,
    AdminSettingsController,
    AdminAuditController,
  ],
  providers: [
    AuditService,
    AdminDashboardService,
    AdminUsersService,
    AdminUtilitiesService,
    AdminAdsService,
    AdminAnalyticsService,
    GrowthIntelligenceService,
    MonetizationIntelligenceService,
    BusinessIntelligenceService,
    JourneyIntelligenceService,
    SeoIntelligenceService,
    AdminAiService,
    AdminSettingsService,
    AdminAuditService,
  ],
  exports: [
    AuditService,
    GrowthIntelligenceService,
    MonetizationIntelligenceService,
    BusinessIntelligenceService,
    JourneyIntelligenceService,
    SeoIntelligenceService,
  ],
})
export class AdminModule {}



