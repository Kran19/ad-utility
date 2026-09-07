import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { AdPlacement, DeviceType } from '@ad-utility/shared';

export interface DecodedTrackingToken {
  creativeId: string;
  campaignId: string;
  placementId: string;
  placementCode: AdPlacement;
  utilitySlug?: string;
  deviceType?: DeviceType;
  timestamp: number;
}

@Injectable()
export class TrackingTokenService {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.secret =
      this.config.get<string>('JWT_SECRET') ||
      'fallback_ad_tracking_secret_min_32_characters_here';
  }

  /**
   * Generate an opaque signed tracking token
   */
  generateToken(payload: Omit<DecodedTrackingToken, 'timestamp'>): string {
    const timestamp = Date.now();
    const data: DecodedTrackingToken = { ...payload, timestamp };
    const serialized = Buffer.from(JSON.stringify(data)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(serialized).digest('base64url');
    return `${serialized}.${signature}`;
  }

  /**
   * Verify and decode a tracking token
   */
  verifyToken(token: string): DecodedTrackingToken {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Missing tracking token');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Malformed tracking token');
    }

    const [serialized, signature] = parts;
    const expectedSignature = createHmac('sha256', this.secret).update(serialized).digest('base64url');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid tracking token signature');
    }

    try {
      const jsonStr = Buffer.from(serialized, 'base64url').toString('utf8');
      const payload: DecodedTrackingToken = JSON.parse(jsonStr);

      // Verify token freshness (24-hour validity window)
      const maxAgeMs = 24 * 60 * 60 * 1000;
      if (Date.now() - payload.timestamp > maxAgeMs) {
        throw new BadRequestException('Expired tracking token');
      }

      return payload;
    } catch (err: any) {
      throw new BadRequestException(`Tracking token verification failed: ${err.message}`);
    }
  }
}
