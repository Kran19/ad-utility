/**
 * Canonical Site Origin & Global SEO Configuration
 */

export const siteConfig = {
  name: 'UtilityPlatform',
  titleTemplate: '%s — Free Online Tool | UtilityPlatform',
  defaultTitle: 'UtilityPlatform — Fast, Secure & Free Online Utilities',
  defaultDescription:
    'Free, high-performance web utilities for image conversion, PDF processing, text manipulation, and AI-assisted writing. Fast, isolated, and privacy-first.',
  defaultKeywords: [
    'online utilities',
    'free online tools',
    'image converter',
    'pdf merge',
    'pdf compressor',
    'pdf to jpg',
    'text cleaner',
    'case converter',
    'ai humanizer',
    'ai paraphraser',
    'grammar checker',
  ],
};

/**
 * Resolve deterministic absolute site origin across local, Docker, staging, and production.
 */
export function getSiteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim().length > 0) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, '');
  }

  if (process.env.VERCEL_URL && process.env.VERCEL_URL.trim().length > 0) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, '')}`;
  }

  // Development/Docker fallback
  return 'http://localhost:3001';
}

/**
 * Resolve public API URL for client-side browser requests (Ads, Analytics, Tool execution, Admin).
 *
 * Production behavior:
 * - When NEXT_PUBLIC_API_URL is configured, uses that origin normalized to /api/v1.
 * - In production browser, defaults to same-origin relative '/api/v1' routing through reverse proxy / ingress.
 * - In local development, falls back to port 4001 or 4000 localhost API.
 */
export function getClientApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured && configured.length > 0) {
    const trimmed = configured.replace(/\/+$/, '');
    if (!trimmed.endsWith('/api/v1')) {
      return `${trimmed}/api/v1`;
    }
    return trimmed;
  }

  // Browser execution
  if (typeof window !== 'undefined') {
    if (process.env.NODE_ENV === 'production') {
      const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
      return `${basePath}/api/v1`;
    }
    const hostname = window.location?.hostname || 'localhost';
    const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || (window.location?.port === '3001' ? '4001' : '4001');
    return `http://${hostname}:${backendPort}/api/v1`;
  }

  // SSR fallback
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal && internal.length > 0) {
    return internal.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:4000/api/v1';
  }

  const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || '4001';
  return `http://localhost:${backendPort}/api/v1`;
}

/**
 * Get internal API URL for SSR operations inside Docker or node host.
 */
export function getInternalApiUrl(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal && internal.length > 0) {
    return internal.replace(/\/+$/, '');
  }

  return getClientApiUrl();
}

/**
 * Detect runtime base path (e.g. '/utility' when deployed under reverse proxy).
 */
export function getBasePath(): string {
  if (typeof window !== 'undefined') {
    if (window.location.pathname.startsWith('/utility')) {
      return '/utility';
    }
  }
  return (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
}

/**
 * Normalize any creative media URL or filename to an adblock-safe static path with base path support.
 */
export function normalizeMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:image/')) return url;

  const filename = url.split('/').pop() || '';
  const lower = (filename + ' ' + url).toLowerCase();
  const bp = getBasePath();

  let promoPath = '';
  if (lower.includes('aviator') && (lower.includes('728') || lower.includes('top'))) promoPath = '/media/promos/aviator-top.jpg';
  else if (lower.includes('aviator') && (lower.includes('250') || lower.includes('mid'))) promoPath = '/media/promos/aviator-mid.jpg';
  else if (lower.includes('aviator') && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('300 600') || lower.includes('side'))) promoPath = '/media/promos/aviator-side.jpg';
  else if (lower.includes('aviator') && (lower.includes('125') || lower.includes('badge'))) promoPath = '/media/promos/aviator-badge.jpg';
  else if (lower.includes('aviator') && (lower.includes('160') || lower.includes('tall'))) promoPath = '/media/promos/aviator-tall.jpg';
  else if (lower.includes('aviator')) promoPath = '/media/promos/aviator-top.jpg';

  else if (lower.includes('jetx') && (lower.includes('728') || lower.includes('top'))) promoPath = '/media/promos/jetx-top.jpg';
  else if (lower.includes('jetx') && (lower.includes('250') || lower.includes('mid'))) promoPath = '/media/promos/jetx-mid.jpg';
  else if (lower.includes('jetx') && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('300 600') || lower.includes('side'))) promoPath = '/media/promos/jetx-side.jpg';
  else if (lower.includes('jetx') && (lower.includes('125') || lower.includes('badge'))) promoPath = '/media/promos/jetx-badge.jpg';
  else if (lower.includes('jetx') && (lower.includes('160') || lower.includes('tall'))) promoPath = '/media/promos/jetx-tall.jpg';
  else if (lower.includes('jetx')) promoPath = '/media/promos/jetx-top.jpg';

  else if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('728') || lower.includes('top'))) promoPath = '/media/promos/roulette-top.jpg';
  else if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('250') || lower.includes('mid'))) promoPath = '/media/promos/roulette-mid.jpg';
  else if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('300 600') || lower.includes('side'))) promoPath = '/media/promos/roulette-side.jpg';
  else if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('125') || lower.includes('badge'))) promoPath = '/media/promos/roulette-badge.jpg';
  else if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('160') || lower.includes('tall'))) promoPath = '/media/promos/roulette-tall.jpg';
  else if (lower.includes('roulette') || lower.includes('roullet')) promoPath = '/media/promos/roulette-top.jpg';
  else {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      if (bp && url.startsWith(bp)) return url;
      return `${bp}${url}`;
    }
    return `${bp}/${url}`;
  }

  return `${bp}${promoPath}`;
}

