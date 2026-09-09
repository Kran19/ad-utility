import { Injectable, Logger } from '@nestjs/common';
import {
  AdSlotRequestDto,
  DeviceType,
  ProviderHealthDto,
} from '@ad-utility/shared';
import {
  ExternalAdProvider,
  ExternalAdResponse,
  ExternalRevenueReportDto,
} from './external-ad-provider.interface';

@Injectable()
export class MockExternalAdProviderService implements ExternalAdProvider {
  readonly name = 'mock_network';
  private readonly logger = new Logger(MockExternalAdProviderService.name);

  // Controllable flags for automated testing
  public shouldFail = false;
  public shouldTimeout = false;
  public timeoutDelayMs = 400; // default delay when simulating timeout (higher than 200ms)
  public shouldReturnEmpty = false;

  private requestCount = 0;
  private impressionCount = 0;
  private clickCount = 0;
  private lastRequestTime: Date | null = null;

  isConfigured(): boolean {
    return true;
  }

  async healthCheck(): Promise<ProviderHealthDto> {
    return {
      status: 'CONFIGURED',
      health: this.shouldFail ? 'UNAVAILABLE' : 'HEALTHY',
      provider: this.name,
      lastSuccessfulRequest: this.lastRequestTime ? this.lastRequestTime.toISOString() : null,
      lastSuccessfulSync: new Date().toISOString(),
      lastErrorTimestamp: this.shouldFail ? new Date().toISOString() : null,
      lastErrorMessage: this.shouldFail ? 'Simulated mock network outage' : null,
      errorCount: this.shouldFail ? 1 : 0,
      totalRequests: this.requestCount,
      fallbackRate: 0,
    };
  }

  async requestAd(
    slotRequest: AdSlotRequestDto,
    context: { device: DeviceType; country?: string; sessionId: string },
  ): Promise<ExternalAdResponse | null> {
    this.requestCount++;
    this.lastRequestTime = new Date();

    if (this.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, this.timeoutDelayMs));
    }

    if (this.shouldFail) {
      throw new Error('Mock external ad network error: connection reset');
    }

    if (this.shouldReturnEmpty) {
      return null;
    }

    // Determine dimensions by placement & device
    let width = 728;
    let height = 90;
    if (context.device === 'MOBILE') {
      width = slotRequest.placement === 'MOBILE_STICKY' ? 320 : 300;
      height = slotRequest.placement === 'MOBILE_STICKY' ? 50 : 250;
    } else if (slotRequest.placement === 'SIDEBAR' || slotRequest.placement === 'MID_CONTENT') {
      width = 300;
      height = 250;
    }

    const providerAdId = `mock_ext_${slotRequest.placement.toLowerCase()}_${Date.now()}`;

    return {
      providerAdId,
      creativeType: 'IMAGE',
      mediaUrl: `https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=${width}&h=${height}&q=80`,
      targetUrl: 'https://example.com/sponsor?ref=mock_network',
      width,
      height,
      altText: `Sponsored Advertisement via ${this.name}`,
      revenueEligible: true,
      externalMetadata: {
        networkName: 'MockAdNetwork',
        placement: slotRequest.placement,
        device: context.device,
        country: context.country || 'GLOBAL',
      },
    };
  }

  async recordImpression(token: string): Promise<void> {
    this.impressionCount++;
    this.logger.debug(`Mock ad provider impression logged for token: ${token.substring(0, 16)}...`);
  }

  async recordClick(token: string): Promise<{ destinationUrl: string }> {
    this.clickCount++;
    this.logger.debug(`Mock ad provider click logged for token: ${token.substring(0, 16)}...`);
    return { destinationUrl: 'https://example.com/sponsor?ref=mock_network' };
  }

  async fetchRevenueReport(startDate: Date, endDate: Date): Promise<ExternalRevenueReportDto[]> {
    const reports: ExternalRevenueReportDto[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    // Generate deterministic daily report for each day in range
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      reports.push({
        providerReportId: `mock_rep_${this.name}_${dateStr}_top`,
        date: new Date(current),
        placement: 'TOP_CONTENT',
        utilitySlug: 'case-converter',
        categorySlug: 'text',
        deviceType: 'DESKTOP',
        impressions: 120,
        clicks: 4,
        revenue: 2.45,
        currency: 'USD',
        source: 'MOCK',
        status: 'ACTUAL',
      });

      reports.push({
        providerReportId: `mock_rep_${this.name}_${dateStr}_sidebar`,
        date: new Date(current),
        placement: 'SIDEBAR',
        utilitySlug: 'json-formatter',
        categorySlug: 'developer',
        deviceType: 'DESKTOP',
        impressions: 85,
        clicks: 2,
        revenue: 1.20,
        currency: 'USD',
        source: 'MOCK',
        status: 'ACTUAL',
      });

      // Advance by 1 day
      current.setDate(current.getDate() + 1);
    }

    return reports;
  }

  getMetrics() {
    return {
      requests: this.requestCount,
      impressions: this.impressionCount,
      clicks: this.clickCount,
    };
  }

  reset() {
    this.shouldFail = false;
    this.shouldTimeout = false;
    this.shouldReturnEmpty = false;
    this.timeoutDelayMs = 400;
    this.requestCount = 0;
    this.impressionCount = 0;
    this.clickCount = 0;
    this.lastRequestTime = null;
  }
}
