'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  AdPlacement,
  AdCreativePayload,
  AdSlotResponseDto,
  DeviceType,
  ApiEnvelope,
} from '@ad-utility/shared';

interface AdSlotProps {
  placement: AdPlacement;
  utilitySlug?: string;
  categorySlug?: string;
  className?: string;
}

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
    if (placement === 'MOBILE_STICKY' && currentDevice !== 'MOBILE') {
      setIsLoading(false);
      return;
    }
    if (placement === 'DESKTOP_STICKY' && currentDevice === 'MOBILE') {
      setIsLoading(false);
      return;
    }

    const fetchAd = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        const res = await fetch(`${apiUrl}/ads/slot`, {
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

        if (!res.ok) {
          if (isMounted) {
            setHasAd(false);
            setIsLoading(false);
          }
          return;
        }

        const json: ApiEnvelope<AdSlotResponseDto> = await res.json();
        if (isMounted) {
          if (json.success && json.data && json.data.hasAd && json.data.creative) {
            setAdCreative(json.data.creative);
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
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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
        data-ad-placement={placement}
        className={`w-full mx-auto my-3 flex items-center justify-center rounded-lg bg-gray-900/20 border border-gray-800/40 text-gray-600 text-xs font-mono animate-pulse ${config.minHeight} ${config.maxWidth} ${className}`}
      >
        <span className="text-[10px] text-gray-500">Sponsored Advertisement</span>
      </div>
    );
  }

  if (!hasAd || !adCreative) {
    return null; // Clean no-ad behavior
  }

  return (
    <div
      ref={slotRef}
      data-ad-placement={placement}
      data-creative-id={adCreative.creativeId}
      className={`w-full mx-auto my-4 flex flex-col items-center justify-center relative overflow-hidden rounded-xl bg-gray-900/60 border border-gray-800/80 shadow-lg ${config.maxWidth} ${className}`}
    >
      <div className="absolute top-1 right-2 z-10 text-[9px] uppercase tracking-wider text-gray-400 bg-gray-950/80 px-1.5 py-0.5 rounded font-mono">
        Ad
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
            width={adCreative.width || 728}
            height={adCreative.height || 90}
            className="w-full h-auto object-cover rounded-lg mx-auto"
            loading="lazy"
          />
        </a>
      )}

      {adCreative.type === 'VIDEO' && adCreative.mediaUrl && (
        <div className="w-full text-center">
          <video
            src={adCreative.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-auto rounded-lg mx-auto"
          />
        </div>
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
