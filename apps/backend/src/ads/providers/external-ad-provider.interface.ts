import {
  AdSlotRequestDto,
  DeviceType,
  CreativeType,
  ProviderHealthDto,
} from '@ad-utility/shared';

export interface ExternalAdResponse {
  providerAdId: string;
  creativeType: CreativeType;
  mediaUrl?: string;
  targetUrl: string;
  width?: number;
  height?: number;
  altText?: string;
  customHtml?: string;
  revenueEligible: boolean;
  externalMetadata?: Record<string, any>;
}

export interface ExternalRevenueReportDto {
  providerReportId: string;
  date: Date;
  placement?: string;
  utilitySlug?: string;
  categorySlug?: string;
  deviceType?: DeviceType;
  impressions: number;
  clicks: number;
  revenue: number;
  currency: string;
  source: string;
  status: 'ACTUAL' | 'ACTUAL_ZERO' | 'UNAVAILABLE';
}

export interface ExternalAdProvider {
  readonly name: string;
  isConfigured(): boolean;
  healthCheck(): Promise<ProviderHealthDto>;
  requestAd(
    slotRequest: AdSlotRequestDto,
    context: { device: DeviceType; country?: string; sessionId: string },
  ): Promise<ExternalAdResponse | null>;
  recordImpression(token: string): Promise<void>;
  recordClick(token: string): Promise<{ destinationUrl: string }>;
  fetchRevenueReport(startDate: Date, endDate: Date): Promise<ExternalRevenueReportDto[]>;
}
