'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  AdPlacement,
  AdCreativePayload,
  AdSlotResponseDto,
  DeviceType,
  ApiEnvelope,
} from '@ad-utility/shared';
import { getClientApiUrl } from '../../lib/site-config';

interface AdSlotProps {
  placement: AdPlacement;
  utilitySlug?: string;
  categorySlug?: string;
  className?: string;
}

const normalizeMediaUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  const filename = url.split('/').pop() || '';
  const lower = filename.toLowerCase();

  if (lower.includes('aviator') && (lower.includes('728') || lower.includes('top'))) return '/media/promos/aviator-top.jpg';
  if (lower.includes('aviator') && (lower.includes('250') || lower.includes('mid'))) return '/media/promos/aviator-mid.jpg';
  if (lower.includes('aviator') && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('side'))) return '/media/promos/aviator-side.jpg';
  if (lower.includes('aviator') && (lower.includes('125') || lower.includes('badge'))) return '/media/promos/aviator-badge.jpg';
  if (lower.includes('aviator') && (lower.includes('160') || lower.includes('tall'))) return '/media/promos/aviator-tall.jpg';

  if (lower.includes('jetx') && (lower.includes('728') || lower.includes('top'))) return '/media/promos/jetx-top.jpg';
  if (lower.includes('jetx') && (lower.includes('250') || lower.includes('mid'))) return '/media/promos/jetx-mid.jpg';
  if (lower.includes('jetx') && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('side'))) return '/media/promos/jetx-side.jpg';
  if (lower.includes('jetx') && (lower.includes('125') || lower.includes('badge'))) return '/media/promos/jetx-badge.jpg';
  if (lower.includes('jetx') && (lower.includes('160') || lower.includes('tall'))) return '/media/promos/jetx-tall.jpg';

  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('728') || lower.includes('top'))) return '/media/promos/roulette-top.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('250') || lower.includes('mid'))) return '/media/promos/roulette-mid.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('300x600') || lower.includes('300-600') || lower.includes('side'))) return '/media/promos/roulette-side.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('125') || lower.includes('badge'))) return '/media/promos/roulette-badge.jpg';
  if ((lower.includes('roulette') || lower.includes('roullet')) && (lower.includes('160') || lower.includes('tall'))) return '/media/promos/roulette-tall.jpg';

  return url;
};

const PLACEMENT_CONFIG: Record<AdPlacement, { label: string; minHeight: string; maxWidth?: string }> = {
  HEADER_BANNER: { label: 'Header Banner', minHeight: 'min-h-[50px] sm:min-h-[90px]', maxWidth: 'max-w-[728px]' },
  TOP_CONTENT: { label: 'Top Content Banner', minHeight: 'min-h-[90px]', maxWidth: 'max-w-[728px]' },
  AFTER_TOOL: { label: 'After Tool Banner', minHeight: 'min-h-[90px]', maxWidth: 'max-w-[728px]' },
  MID_CONTENT: { label: 'Mid Content Banner', minHeight: 'min-h-[90px]', maxWidth: 'max-w-[728px]' },
  BOTTOM_CONTENT: { label: 'Bottom Content Banner', minHeight: 'min-h-[90px]', maxWidth: 'max-w-[728px]' },
  SIDEBAR: { label: 'Sidebar Banner', minHeight: 'min-h-[250px]', maxWidth: 'max-w-[300px]' },
  MOBILE_STICKY: { label: 'Mobile Sticky Footer', minHeight: 'min-h-[50px]', maxWidth: 'max-w-[320px]' },
  DESKTOP_STICKY: { label: 'Desktop Corner Sticky', minHeight: 'min-h-[250px]', maxWidth: 'max-w-[300px]' },
};

export const AdSlot: React.FC<AdSlotProps> = ({
  placement,
  utilitySlug,
  categorySlug,
  className = '',
}) => {
  const [adCreative, setAdCreative] = useState<AdCreativePayload | null>(null);
  const [hasAd, setHasAd] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const slotRef = useRef<HTMLDivElement>(null);
  const impressionRecordedRef = useRef<boolean>(false);

  // 1. Resolve client device
  const getDeviceType = (): DeviceType => {
    if (typeof window === 'undefined') return 'DESKTOP';
    const width = window.innerWidth;
    if (width < 640) return 'MOBILE';
    if (width < 1024) return 'TABLET';
    return 'DESKTOP';
  };

  useEffect(() => {
    let isMounted = true;

    // Device restriction guard for sticky placements
    const currentDevice = getDeviceType();
    if (placement === 'MOBILE_STICKY' && currentDevice === 'DESKTOP') {
      setIsLoading(false);
      return;
    }
    if (placement === 'SIDEBAR' && currentDevice !== 'DESKTOP') {
      setIsLoading(false);
      return;
    }
    if (placement === 'DESKTOP_STICKY' && currentDevice !== 'DESKTOP') {
      setIsLoading(false);
      return;
    }

    const fetchAd = async () => {
      try {
        const apiUrl = getClientApiUrl();
        let res: Response | null = null;
        try {
          res = await fetch(`${apiUrl}/ads/slot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              placement,
              utilitySlug,
              categorySlug,
              device: currentDevice,
            }),
          });
        } catch {
          // Primary fetch failed, proceed to fallback attempt
        }

        if ((!res || !res.ok) && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          try {
            const altPort = apiUrl.includes('4000') ? '4001' : '4000';
            const altRes = await fetch(`http://${window.location.hostname}:${altPort}/api/v1/ads/slot`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                placement,
                utilitySlug,
                categorySlug,
                device: currentDevice,
              }),
            });
            if (altRes.ok) {
              res = altRes;
            }
          } catch {}
        }

        if (!res || !res.ok) {
          if (isMounted) {
            setHasAd(false);
            setIsLoading(false);
          }
          return;
        }

        const json: ApiEnvelope<AdSlotResponseDto> = await res.json();
        if (isMounted) {
          if (json.success && json.data && json.data.hasAd && json.data.creative) {
            const creative = { ...json.data.creative };
            if (creative.mediaUrl) {
              creative.mediaUrl = normalizeMediaUrl(creative.mediaUrl);
            }
            setAdCreative(creative);
            setHasAd(true);
          } else {
            setHasAd(false);
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setHasAd(false);
          setIsLoading(false);
        }
      }
    };

    fetchAd();

    return () => {
      isMounted = false;
    };
  }, [placement, utilitySlug, categorySlug]);

  // 2. Track Impression via IntersectionObserver
  useEffect(() => {
    if (!hasAd || !adCreative || impressionRecordedRef.current || !slotRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !impressionRecordedRef.current) {
          impressionRecordedRef.current = true;
          const apiUrl = getClientApiUrl();
          fetch(`${apiUrl}/ads/impression`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackingToken: adCreative.trackingToken,
              placement,
              utilitySlug,
              device: getDeviceType(),
            }),
          }).catch(() => {
            // Non-blocking fail-open
          });
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(slotRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasAd, adCreative, placement, utilitySlug]);

  // 3. Handle Click Tracking & Navigation
  const handleAdClick = async (e: React.MouseEvent) => {
    if (!adCreative) return;

    e.preventDefault();
    const apiUrl = getClientApiUrl();

    // Broadcast real-time click notification to admin panel immediately
    try {
      if (typeof window !== 'undefined') {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('ad_analytics_sync');
          bc.postMessage({ type: 'AD_CLICK', utilitySlug, timestamp: Date.now() });
          bc.close();
        }
        window.localStorage.setItem('ad_analytics_click_event', Date.now().toString());
      }
    } catch {}

    try {
      const res = await fetch(`${apiUrl}/ads/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingToken: adCreative.trackingToken,
          placement,
          utilitySlug,
          device: getDeviceType(),
        }),
      });

      const json = await res.json();
      const destination = json.data?.destinationUrl || adCreative.targetUrl || '#';
      window.open(destination, '_blank', 'noopener,noreferrer');
    } catch {
      // Fallback direct open if API fails
      if (adCreative.targetUrl) {
        window.open(adCreative.targetUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const config = PLACEMENT_CONFIG[placement] || { minHeight: 'min-h-[50px]', maxWidth: 'max-w-full' };

  if (isLoading) {
    return (
      <div
        data-slot={placement}
        className={`w-full mx-auto my-3 flex items-center justify-center rounded-2xl bg-slate-100/60 border border-slate-200/60 text-slate-400 text-xs font-mono animate-pulse ${config.minHeight} ${config.maxWidth} ${className}`}
      >
        <span className="text-[10px] text-slate-400">Featured Partner</span>
      </div>
    );
  }

  if (!hasAd || !adCreative) {
    return null; // Clean no-ad behavior
  }

  // Determine container max width based on creative dimension or placement default
  const containerMaxWidth = adCreative?.width && adCreative.width > 0
    ? `${adCreative.width}px`
    : undefined;

  const imageMaxHeight = adCreative?.height && adCreative.height > 0
    ? `${adCreative.height}px`
    : undefined;

  return (
    <div
      ref={slotRef}
      data-slot={placement}
      data-content-id={adCreative.creativeId}
      style={{
        maxWidth: containerMaxWidth || undefined,
      }}
      className={`w-full mx-auto my-4 relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-xs flex justify-center items-center ${
        !containerMaxWidth ? config.maxWidth || 'max-w-full' : 'max-w-full'
      } ${className}`}
    >
      <div className="absolute top-2 right-2 z-10 text-[9px] uppercase tracking-wider text-white/95 bg-slate-950/75 backdrop-blur-xs px-2 py-0.5 rounded font-mono font-semibold pointer-events-none shadow-sm">
        Partner
      </div>

      {adCreative.type === 'IMAGE' && adCreative.mediaUrl && (
        <a
          href={adCreative.targetUrl || '#'}
          onClick={handleAdClick}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center transition-opacity hover:opacity-95"
        >
          <img
            src={adCreative.mediaUrl}
            alt={adCreative.altText || 'Advertisement'}
            style={{
              maxHeight: imageMaxHeight || undefined,
              maxWidth: containerMaxWidth || undefined,
            }}
            className="w-full h-auto max-w-full mx-auto block rounded-2xl object-contain"
            loading="lazy"
          />
        </a>
      )}

      {adCreative.type === 'VIDEO' && adCreative.mediaUrl && (
        <a
          href={adCreative.targetUrl || '#'}
          onClick={handleAdClick}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center cursor-pointer"
        >
          <video
            src={adCreative.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-auto rounded-lg mx-auto"
          />
        </a>
      )}

      {adCreative.type === 'HTML' && adCreative.customHtml && (
        <div
          onClick={handleAdClick}
          className="w-full p-2 cursor-pointer"
          dangerouslySetInnerHTML={{ __html: adCreative.customHtml }}
        />
      )}

      {adCreative.type === 'IFRAME' && adCreative.mediaUrl && (
        <iframe
          src={adCreative.mediaUrl}
          width={adCreative.width || 728}
          height={adCreative.height || 90}
          title={adCreative.altText || 'Advertisement Frame'}
          sandbox="allow-scripts allow-popups allow-forms"
          className="w-full border-0 rounded-lg"
          loading="lazy"
        />
      )}
    </div>
  );
};
