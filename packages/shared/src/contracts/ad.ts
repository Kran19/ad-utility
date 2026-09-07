export type AdPlacement =
  | 'HEADER_BANNER'
  | 'TOP_CONTENT'
  | 'AFTER_TOOL'
  | 'MID_CONTENT'
  | 'BOTTOM_CONTENT'
  | 'SIDEBAR'
  | 'MOBILE_STICKY'
  | 'DESKTOP_STICKY';

export type DeviceType = 'MOBILE' | 'TABLET' | 'DESKTOP';

export type CreativeType = 'IMAGE' | 'VIDEO' | 'HTML' | 'IFRAME';

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';

/**
 * Ad Slot Request Payload sent by frontend or client
 */
export interface AdSlotRequestDto {
  placement: AdPlacement;
  utilitySlug?: string;
  categorySlug?: string;
  device?: DeviceType;
  country?: string;
  sessionId?: string;
}

/**
 * Public Creative Payload returned in Ad Slot response
 */
export interface AdCreativePayload {
  creativeId: string;
  campaignId: string;
  type: CreativeType;
  mediaUrl?: string;
  targetUrl?: string;
  width?: number;
  height?: number;
  altText?: string;
  customHtml?: string;
  trackingToken: string;
}

/**
 * Ad Slot Response Payload
 */
export interface AdSlotResponseDto {
  hasAd: boolean;
  placement: AdPlacement;
  creative?: AdCreativePayload;
  fallbackTier?: string;
  sessionId?: string;
}

/**
 * Request payload to record an ad impression
 */
export interface AdImpressionRequestDto {
  trackingToken: string;
  placement: AdPlacement;
  utilitySlug?: string;
  device?: DeviceType;
  country?: string;
  sessionId?: string;
}

/**
 * Request payload to record an ad click
 */
export interface AdClickRequestDto {
  trackingToken: string;
  placement: AdPlacement;
  utilitySlug?: string;
  device?: DeviceType;
  country?: string;
  sessionId?: string;
}

/**
 * Response payload for click tracking (authoritative destination URL)
 */
export interface AdClickResponseDto {
  destinationUrl: string;
}

// Backward-compatible aliases
export type AdSlotRequest = AdSlotRequestDto;
export type AdSlotResponse = AdSlotResponseDto;
