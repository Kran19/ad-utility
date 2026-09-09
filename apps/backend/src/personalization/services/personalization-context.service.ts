import { Injectable } from '@nestjs/common';
import {
  PersonalizationContextDto,
  DeviceClass,
  AcquisitionChannel,
  getExperimentVariant,
} from '@ad-utility/shared';

@Injectable()
export class PersonalizationContextService {
  /**
   * Resolves privacy-safe contextual signals from the current request.
   * Completely unpersisted and ephemeral. ZERO individual profiling.
   */
  resolveContext(
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | undefined>,
    body?: {
      utilitySlug?: string;
      categorySlug?: string;
      sessionDepth?: number;
      currentStep?: 'LANDING' | 'TOOL_START' | 'TOOL_COMPLETE' | 'RESULT_DOWNLOAD';
      currentStepCompleted?: boolean;
      sessionToken?: string;
      experimentAssignments?: Record<string, string>;
    },
  ): PersonalizationContextDto {
    const userAgent = this.getHeaderValue(headers, 'user-agent') || '';
    const referer = this.getHeaderValue(headers, 'referer') || '';

    const deviceType = this.resolveDeviceClass(userAgent);
    const acquisitionChannel = this.resolveAcquisitionChannel(query, referer);

    const sessionDepth = Math.max(1, Math.min(body?.sessionDepth || 1, 50));

    // Resolve experiment assignments if session token is provided
    const experimentAssignments: Record<string, string> = {
      ...(body?.experimentAssignments || {}),
    };

    if (body?.sessionToken && typeof body.sessionToken === 'string') {
      const activeExperiments = [
        { id: 'exp_utility_cta_v1', variants: [{ id: 'control', weight: 50 }, { id: 'variant_b', weight: 50 }] },
        { id: 'exp_related_ranking_v1', variants: [{ id: 'control', weight: 50 }, { id: 'variant_b', weight: 50 }] },
      ];
      for (const exp of activeExperiments) {
        if (!experimentAssignments[exp.id]) {
          experimentAssignments[exp.id] = getExperimentVariant(exp.id, body.sessionToken, exp.variants);
        }
      }
    }

    return {
      utilitySlug: body?.utilitySlug || query.utilitySlug,
      categorySlug: body?.categorySlug || query.categorySlug,
      deviceType,
      acquisitionChannel,
      sessionDepth,
      currentStep: body?.currentStep || 'LANDING',
      experimentAssignments,
      currentStepCompleted: body?.currentStepCompleted || false,
    };
  }

  /**
   * Extract coarse device class from User-Agent string.
   */
  resolveDeviceClass(userAgent: string): DeviceClass {
    const ua = userAgent.toLowerCase();
    if (!ua) return 'unknown';

    if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android.*mobile|blackberry|phone|iemobile/i.test(ua)) {
      return 'mobile';
    }
    if (/windows|macintosh|mac os x|linux|cros/i.test(ua)) {
      return 'desktop';
    }
    return 'unknown';
  }

  /**
   * Extract coarse acquisition channel from query parameters & referer.
   */
  resolveAcquisitionChannel(
    query: Record<string, string | undefined>,
    referer: string,
  ): AcquisitionChannel {
    const utmMedium = (query.utm_medium || query.utmMedium || '').toLowerCase();
    const utmSource = (query.utm_source || query.utmSource || '').toLowerCase();

    // 1. Check Paid
    if (
      ['cpc', 'ppc', 'paid', 'paidsearch', 'display', 'paidsocial'].includes(utmMedium) ||
      ['adwords', 'googleads', 'meta_ads'].includes(utmSource)
    ) {
      return 'paid';
    }

    // 2. Check Social
    if (
      ['social', 'social_media'].includes(utmMedium) ||
      ['twitter', 'x', 'facebook', 'instagram', 'linkedin', 'reddit', 'tiktok', 'pinterest'].some(
        (s) => utmSource.includes(s) || referer.includes(s),
      )
    ) {
      return 'social';
    }

    // 3. Check Organic Search
    if (
      ['organic', 'search'].includes(utmMedium) ||
      ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'yandex', 'baidu'].some(
        (e) => utmSource.includes(e) || referer.includes(e),
      )
    ) {
      return 'organic';
    }

    // 4. Check Referral
    if (utmMedium === 'referral' || (referer && !referer.includes('localhost') && !referer.includes('utilityplatform.com'))) {
      return 'referral';
    }

    // 5. Direct or Unknown
    if (referer === '' && !utmMedium && !utmSource) {
      return 'direct';
    }

    return 'unknown';
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ): string {
    const val = headers[key] || headers[key.toLowerCase()];
    if (Array.isArray(val)) return val[0] || '';
    return val || '';
  }
}
