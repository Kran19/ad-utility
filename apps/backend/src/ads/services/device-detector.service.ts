import { Injectable } from '@nestjs/common';
import { DeviceType } from '@ad-utility/shared';

@Injectable()
export class DeviceDetectorService {
  /**
   * Resolve canonical DeviceType from client hint and/or User-Agent header
   */
  resolveDevice(deviceHint?: DeviceType | string, userAgent?: string): DeviceType {
    // 1. Explicit validated client hint takes precedence if valid
    if (deviceHint) {
      const normalized = deviceHint.toUpperCase().trim();
      if (normalized === 'MOBILE' || normalized === 'TABLET' || normalized === 'DESKTOP') {
        return normalized as DeviceType;
      }
    }

    // 2. Parse User-Agent header
    if (!userAgent) {
      return 'DESKTOP';
    }

    const ua = userAgent.toLowerCase();

    // Tablet patterns
    if (
      ua.includes('ipad') ||
      ua.includes('tablet') ||
      (ua.includes('android') && !ua.includes('mobile')) ||
      (ua.includes('silk') && !ua.includes('mobile'))
    ) {
      return 'TABLET';
    }

    // Mobile patterns
    if (
      ua.includes('mobi') ||
      ua.includes('iphone') ||
      ua.includes('ipod') ||
      ua.includes('android') ||
      ua.includes('blackberry') ||
      ua.includes('opera mini') ||
      ua.includes('windows phone')
    ) {
      return 'MOBILE';
    }

    return 'DESKTOP';
  }
}
