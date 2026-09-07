import { AnalyticsEventDto, AnalyticsEventType } from '@ad-utility/shared';

const SESSION_KEY = 'ad_platform_session_token';
const UTM_KEY = 'ad_platform_utm_data';

/**
 * Get or create anonymous session token (SSR Safe)
 */
export function getAnonymousSessionToken(): string {
  if (typeof window === 'undefined') return 'ssr_session';

  try {
    let token = window.sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      token = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      window.sessionStorage.setItem(SESSION_KEY, token);
    }
    return token;
  } catch {
    return 'fallback_session';
  }
}

/**
 * Capture and cache UTM parameters from current URL
 */
export function captureUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};

    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    let hasUtm = false;

    for (const key of utmKeys) {
      const val = params.get(key);
      if (val) {
        utm[key] = val.substring(0, 100);
        hasUtm = true;
      }
    }

    if (hasUtm) {
      window.sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
      return utm;
    }

    // Retrieve cached UTM from previous touch in this session
    const cached = window.sessionStorage.getItem(UTM_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // ignore
  }

  return {};
}

/**
 * Track an analytics event non-blockingly
 */
export function trackEvent(payload: Omit<AnalyticsEventDto, 'sessionToken'> & { sessionToken?: string }): void {
  if (typeof window === 'undefined') return;

  try {
    const sessionToken = payload.sessionToken || getAnonymousSessionToken();
    const utm = captureUtmParams();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

    const eventData: AnalyticsEventDto = {
      eventId: 'evt_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
      eventType: payload.eventType,
      utilitySlug: payload.utilitySlug,
      placementCode: payload.placementCode,
      creativeId: payload.creativeId,
      sessionToken,
      utmSource: payload.utmSource || utm.utm_source,
      utmMedium: payload.utmMedium || utm.utm_medium,
      utmCampaign: payload.utmCampaign || utm.utm_campaign,
      utmContent: payload.utmContent || utm.utm_content,
      utmTerm: payload.utmTerm || utm.utm_term,
      metadata: payload.metadata || {},
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(eventData);

    // Prefer navigator.sendBeacon for reliable delivery on navigation
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([serialized], { type: 'application/json' });
      const sent = navigator.sendBeacon(`${apiUrl}/analytics/events`, blob);
      if (sent) return;
    }

    // Fallback to fetch (non-blocking)
    fetch(`${apiUrl}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
      keepalive: true,
    }).catch(() => {
      // Non-blocking fail-open
    });
  } catch {
    // Non-blocking fail-open
  }
}

/**
 * Telemetry Helpers
 */
export function trackPageView(utilitySlug?: string): void {
  trackEvent({ eventType: 'PAGE_VIEW', utilitySlug });
}

export function trackToolStart(utilitySlug: string): void {
  trackEvent({ eventType: 'TOOL_START', utilitySlug });
}

export function trackToolComplete(utilitySlug: string, executionTimeMs?: number): void {
  trackEvent({ eventType: 'TOOL_COMPLETE', utilitySlug, metadata: { executionTimeMs } });
}

export function trackToolError(utilitySlug: string, errorMessage?: string): void {
  trackEvent({ eventType: 'TOOL_ERROR', utilitySlug, metadata: { errorMessage: errorMessage?.substring(0, 200) } });
}
