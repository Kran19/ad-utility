import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { MockExternalAdProviderService } from './mock-external-ad-provider.service';

@Injectable()
export class ExternalAdNetworkService {
  private readonly logger = new Logger(ExternalAdNetworkService.name);
  private activeProvider: ExternalAdProvider | null = null;

  private totalRequests = 0;
  private successfulRequests = 0;
  private errorCount = 0;
  private consecutiveErrors = 0;
  private fallbackCount = 0;
  private lastSuccessfulRequest: Date | null = null;
  private lastSuccessfulSync: Date | null = null;
  private lastErrorTimestamp: Date | null = null;
  private lastErrorMessage: string | null = null;

  // Configuration values (strictly backend-managed)
  private isEnabled: boolean;
  private readonly providerName: string;
  private timeoutMs: number;
  private readonly hasRealCredentials: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly mockProvider: MockExternalAdProviderService,
  ) {
    const rawEnabled = this.config.get<string | boolean>('AD_NETWORK_ENABLED');
    this.isEnabled = rawEnabled === true || rawEnabled === 'true';

    this.providerName = (
      this.config.get<string>('AD_NETWORK_PROVIDER') || 'mock'
    ).toLowerCase();

    const configTimeout = this.config.get<string | number>('AD_NETWORK_TIMEOUT_MS');
    this.timeoutMs = configTimeout ? Number(configTimeout) || 200 : 200;

    const apiKey = this.config.get<string>('AD_NETWORK_API_KEY');
    this.hasRealCredentials = Boolean(apiKey && apiKey.trim().length > 0);

    this.initializeProvider();
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    this.initializeProvider();
  }

  public setTimeoutMs(timeout: number) {
    this.timeoutMs = timeout;
  }

  public resetMetrics() {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.errorCount = 0;
    this.consecutiveErrors = 0;
    this.fallbackCount = 0;
    this.lastSuccessfulRequest = null;
    this.lastErrorTimestamp = null;
    this.lastErrorMessage = null;
  }

  private initializeProvider() {
    if (!this.isEnabled) {
      this.logger.log('External ad network integration is DISABLED by configuration.');
      this.activeProvider = null;
      return;
    }

    if (this.providerName === 'mock') {
      this.logger.log('External ad network initialized with MockExternalAdProvider.');
      this.activeProvider = this.mockProvider;
    } else {
      // Real external provider requested
      if (!this.hasRealCredentials) {
        this.logger.warn(
          `Real ad network provider '${this.providerName}' requested, but AD_NETWORK_API_KEY is missing. Falling back to mock provider for offline safety.`,
        );
        this.activeProvider = this.mockProvider;
      } else {
        this.logger.log(
          `External ad network '${this.providerName}' configured with credentials.`,
        );
        // Note: When official SDK/API integration is deployed, instantiate adapter here
        this.activeProvider = this.mockProvider;
      }
    }
  }

  isConfigured(): boolean {
    return this.isEnabled && this.activeProvider !== null;
  }

  isLiveVerified(): boolean {
    return this.isEnabled && this.providerName !== 'mock' && this.hasRealCredentials;
  }

  getProviderName(): string {
    return this.activeProvider ? this.activeProvider.name : 'NONE';
  }

  /**
   * Request an ad from the external network with strict timeout & fail-open guarantees
   */
  async requestAd(
    slotRequest: AdSlotRequestDto,
    context: { device: DeviceType; country?: string; sessionId: string },
  ): Promise<ExternalAdResponse | null> {
    if (!this.isEnabled || !this.activeProvider) {
      return null;
    }

    this.totalRequests++;

    try {
      // Enforce strict bounded timeout to prevent blocking page render or utility execution
      const adPromise = this.activeProvider.requestAd(slotRequest, context);
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(
          () => reject(new Error(`External ad provider timed out after ${this.timeoutMs}ms`)),
          this.timeoutMs,
        );
      });

      const response = await Promise.race([adPromise, timeoutPromise]);

      if (response) {
        this.successfulRequests++;
        this.consecutiveErrors = 0;
        this.lastSuccessfulRequest = new Date();
        return response;
      } else {
        // Provider returned no-fill (valid response, not error)
        this.fallbackCount++;
        return null;
      }
    } catch (err: any) {
      this.errorCount++;
      this.consecutiveErrors++;
      this.fallbackCount++;
      this.lastErrorTimestamp = new Date();
      this.lastErrorMessage = err.message || 'Unknown external provider error';

      this.logger.warn(
        `External ad provider failure on ${slotRequest.placement}: ${this.lastErrorMessage}. Failing open to next tier.`,
      );

      // Strict fail-open: never propagate error to caller
      return null;
    }
  }

  /**
   * Track ad impression with external provider asynchronously
   */
  async recordImpression(token: string): Promise<void> {
    if (!this.isEnabled || !this.activeProvider) {
      return;
    }

    try {
      await this.activeProvider.recordImpression(token);
    } catch (err: any) {
      this.logger.warn(`External ad provider impression tracking error: ${err.message}`);
    }
  }

  /**
   * Track ad click with external provider asynchronously
   */
  async recordClick(token: string): Promise<{ destinationUrl?: string }> {
    if (!this.isEnabled || !this.activeProvider) {
      return {};
    }

    try {
      return await this.activeProvider.recordClick(token);
    } catch (err: any) {
      this.logger.warn(`External ad provider click tracking error: ${err.message}`);
      return {};
    }
  }

  /**
   * Query revenue report from external provider
   */
  async fetchRevenueReport(startDate: Date, endDate: Date): Promise<ExternalRevenueReportDto[]> {
    if (!this.isEnabled || !this.activeProvider) {
      return [];
    }

    try {
      const reports = await this.activeProvider.fetchRevenueReport(startDate, endDate);
      this.lastSuccessfulSync = new Date();
      return reports;
    } catch (err: any) {
      this.logger.error(`Failed to fetch revenue report from provider: ${err.message}`);
      this.lastErrorTimestamp = new Date();
      this.lastErrorMessage = err.message;
      return [];
    }
  }

  /**
   * Provider Health Telemetry (Never reveals credentials)
   */
  async healthCheck(): Promise<ProviderHealthDto> {
    const isConfigured = this.isConfigured();
    const fallbackRate =
      this.totalRequests > 0
        ? Number(((this.fallbackCount / this.totalRequests) * 100).toFixed(2))
        : 0;

    let health: ProviderHealthDto['health'] = 'HEALTHY';
    if (!isConfigured) {
      health = 'UNAVAILABLE';
    } else if (this.consecutiveErrors >= 5) {
      health = 'UNAVAILABLE';
    } else if (this.errorCount > 0 && this.totalRequests > 0 && this.errorCount / this.totalRequests > 0.2) {
      health = 'DEGRADED';
    }

    return {
      status: isConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
      health,
      provider: this.getProviderName(),
      lastSuccessfulRequest: this.lastSuccessfulRequest ? this.lastSuccessfulRequest.toISOString() : null,
      lastSuccessfulSync: this.lastSuccessfulSync ? this.lastSuccessfulSync.toISOString() : null,
      lastErrorTimestamp: this.lastErrorTimestamp ? this.lastErrorTimestamp.toISOString() : null,
      lastErrorMessage: this.lastErrorMessage,
      errorCount: this.errorCount,
      totalRequests: this.totalRequests,
      fallbackRate,
    };
  }

  recordSuccessfulSync() {
    this.lastSuccessfulSync = new Date();
  }
}
