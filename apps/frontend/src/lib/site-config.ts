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
      return '/api/v1';
    }
    // Local dev: map 3001 frontend port to 4001 backend port
    const port = window.location?.port;
    if (port === '3001') {
      return 'http://localhost:4001/api/v1';
    }
    return 'http://localhost:4000/api/v1';
  }

  // SSR fallback
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal && internal.length > 0) {
    return internal.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:4000/api/v1';
  }

  return 'http://localhost:4001/api/v1';
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

