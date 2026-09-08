import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { UtilitiesController } from './utilities.controller';
import { UtilitiesCacheService } from './services/utilities-cache.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule],
  controllers: [UtilitiesController],
  providers: [UtilitiesService, UtilitiesCacheService],
  exports: [UtilitiesService, UtilitiesCacheService],
})
export class UtilitiesModule {}
