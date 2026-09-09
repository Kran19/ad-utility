import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdsModule } from '../ads/ads.module';
import { PersonalizationContextService } from './services/personalization-context.service';
import { PersonalizationRuleService } from './services/personalization-rule.service';
import { ConversionIntelligenceService } from './services/conversion-intelligence.service';
import { PersonalizationController } from './controllers/personalization.controller';

@Module({
  imports: [PrismaModule, AdsModule],
  controllers: [PersonalizationController],
  providers: [
    PersonalizationContextService,
    PersonalizationRuleService,
    ConversionIntelligenceService,
  ],
  exports: [
    PersonalizationContextService,
    PersonalizationRuleService,
    ConversionIntelligenceService,
  ],
})
export class PersonalizationModule {}
