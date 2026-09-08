import { Injectable, BadRequestException } from '@nestjs/common';
import { AnalyticsEventDto, AnalyticsEventType } from '@ad-utility/shared';

const VALID_EVENT_TYPES: Set<string> = new Set([
  'PAGE_VIEW',
  'TOOL_START',
  'TOOL_COMPLETE',
  'TOOL_ERROR',
  'RESULT_DOWNLOAD',
  'AD_IMPRESSION',
  'AD_CLICK',
  'AI_REQUEST',
  'EXPERIMENT_EXPOSURE',
]);

@Injectable()
export class AnalyticsValidationService {
  /**
   * Validate and sanitize a single analytics event payload
   */
  validateAndSanitizeEvent(raw: any): AnalyticsEventDto {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Event payload must be a non-null object');
    }

    // 1. Normalize and validate Event Type
    const rawType = String(raw.eventType || '').toUpperCase().trim();
    if (!VALID_EVENT_TYPES.has(rawType)) {
      throw new BadRequestException(`Invalid analytics eventType: "${raw.eventType}"`);
    }
    const eventType = rawType as AnalyticsEventType;

    // 2. Sanitize UTM parameters (max 100 chars, no control characters)
    const sanitizeUtm = (val?: any): string | undefined => {
      if (!val || typeof val !== 'string') return undefined;
      return val.replace(/[^\w\s\-._~:/?#[\]@!$&'()*+,;=]/gi, '').substring(0, 100).trim();
    };

    // 3. Sanitize Utility Slug & Placement
    const sanitizeSlug = (val?: any): string | undefined => {
      if (!val || typeof val !== 'string') return undefined;
      return val.toLowerCase().replace(/[^a-z0-9-_]/g, '').substring(0, 100);
    };

    // 4. Validate Metadata Size (max 5KB JSON)
    let sanitizedMetadata: Record<string, any> = {};
    if (raw.metadata && typeof raw.metadata === 'object') {
      const jsonStr = JSON.stringify(raw.metadata);
      if (jsonStr.length > 5120) {
        throw new BadRequestException('Metadata payload exceeds maximum limit of 5KB');
      }
      try {
        sanitizedMetadata = JSON.parse(jsonStr);
      } catch {
        sanitizedMetadata = {};
      }
    }

    return {
      eventId: typeof raw.eventId === 'string' ? raw.eventId.substring(0, 64) : undefined,
      eventType,
      utilitySlug: sanitizeSlug(raw.utilitySlug),
      placementCode: typeof raw.placementCode === 'string' ? raw.placementCode.substring(0, 50) : undefined,
      creativeId: typeof raw.creativeId === 'string' ? raw.creativeId.substring(0, 50) : undefined,
      sessionToken: typeof raw.sessionToken === 'string' ? raw.sessionToken.substring(0, 100) : undefined,
      anonymousId: typeof raw.anonymousId === 'string' ? raw.anonymousId.substring(0, 100) : undefined,
      utmSource: sanitizeUtm(raw.utmSource),
      utmMedium: sanitizeUtm(raw.utmMedium),
      utmCampaign: sanitizeUtm(raw.utmCampaign),
      utmContent: sanitizeUtm(raw.utmContent),
      utmTerm: sanitizeUtm(raw.utmTerm),
      metadata: sanitizedMetadata,
      timestamp: raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString(),
    };
  }
}
