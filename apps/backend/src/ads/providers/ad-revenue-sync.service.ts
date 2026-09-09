import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExternalAdNetworkService } from './external-ad-network.service';
import {
  MonetizationSyncRequestDto,
  MonetizationSyncResponseDto,
} from '@ad-utility/shared';

@Injectable()
export class AdRevenueSyncService {
  private readonly logger = new Logger(AdRevenueSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adNetworkService: ExternalAdNetworkService,
  ) {}

  /**
   * Synchronize external ad revenue reports within a strictly bounded date range
   */
  async syncRevenue(dto: MonetizationSyncRequestDto = {}): Promise<MonetizationSyncResponseDto> {
    const now = new Date();
    const defaultEnd = now;
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate = dto.startDate ? new Date(dto.startDate) : defaultStart;
    const endDate = dto.endDate ? new Date(dto.endDate) : defaultEnd;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format provided for revenue synchronization');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    // Strict bounded date range check (max 90 days)
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      throw new BadRequestException('Date range cannot exceed 90 days for revenue synchronization');
    }

    this.logger.log(
      `Starting revenue synchronization from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    );

    // 1. Fetch source-authoritative reports from provider
    const reports = await this.adNetworkService.fetchRevenueReport(startDate, endDate);

    if (reports.length === 0) {
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        recordsIngested: 0,
        duplicatesSkipped: 0,
        totalRevenue: 0,
        currency: 'USD',
        status: 'SUCCESS',
        importedAt: new Date().toISOString(),
      };
    }

    let recordsIngested = 0;
    let duplicatesSkipped = 0;
    let totalRevenue = 0;
    const currency = reports[0]?.currency || 'USD';

    // 2. Ingest records with strict deduplication & idempotency
    for (const report of reports) {
      try {
        const reportId = report.providerReportId;

        // Check if report already exists in database
        const existing = await this.prisma.adRevenueRecord.findFirst({
          where: {
            provider: report.source,
            providerReportId: reportId,
          },
        });

        if (existing) {
          duplicatesSkipped++;
          continue;
        }

        // Persist verified revenue record
        await this.prisma.adRevenueRecord.create({
          data: {
            provider: report.source,
            providerReportId: reportId,
            date: report.date,
            placement: report.placement,
            utilitySlug: report.utilitySlug,
            categorySlug: report.categorySlug,
            deviceType: report.deviceType as any,
            impressions: report.impressions,
            clicks: report.clicks,
            revenue: Number(report.revenue.toFixed(4)),
            currency: report.currency,
            source: report.source,
            status: report.status,
            importedAt: new Date(),
          },
        });

        recordsIngested++;
        totalRevenue += report.revenue;
      } catch (err: any) {
        this.logger.warn(`Failed to ingest revenue record ${report.providerReportId}: ${err.message}`);
      }
    }

    this.adNetworkService.recordSuccessfulSync();

    this.logger.log(
      `Revenue synchronization complete: ${recordsIngested} ingested, ${duplicatesSkipped} skipped, total revenue: $${totalRevenue.toFixed(2)}`,
    );

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      recordsIngested,
      duplicatesSkipped,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      currency,
      status: 'SUCCESS',
      importedAt: new Date().toISOString(),
    };
  }
}
