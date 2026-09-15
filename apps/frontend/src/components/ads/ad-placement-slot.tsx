'use client';

import React from 'react';
import { AdPlacement } from '@ad-utility/shared';
import { AdSlot } from './ad-slot';

export interface AdPlacementSlotProps {
  placement: AdPlacement;
  utilitySlug?: string;
  categorySlug?: string;
  className?: string;
}

/**
 * Standardized Ad Placement Inventory Component (Phase 30)
 *
 * Controls physical placement semantics, responsive visibility, and layout boundaries
 * for the 8 canonical ad placements:
 * 1. HEADER_BANNER - Below navbar, above breadcrumbs (Desktop, Tablet, Mobile)
 * 2. TOP_CONTENT - Below description, above Tool workspace (Desktop, Tablet, Mobile)
 * 3. AFTER_TOOL - Below Tool workspace, above How to Use (Desktop, Tablet, Mobile)
 * 4. MID_CONTENT - Between How to Use and FAQ (Desktop, Tablet, Mobile)
 * 5. BOTTOM_CONTENT - Below Related Utilities, above Footer (Desktop, Tablet, Mobile)
 * 6. SIDEBAR - Desktop right column alongside main content (Desktop only)
 * 7. MOBILE_STICKY - Fixed bottom sticky overlay (Mobile only)
 * 8. DESKTOP_STICKY - Floating bottom-right corner overlay (Desktop only)
 *
 * Architecture:
 * AdPlacementSlot (WHERE) -> AdSlot (RENDER) -> /api/v1/ads/slot -> AdSelectorService (WHICH)
 */
export const AdPlacementSlot: React.FC<AdPlacementSlotProps> = ({
  placement,
  utilitySlug,
  categorySlug,
  className = '',
}) => {
  switch (placement) {
    case 'HEADER_BANNER':
      return (
        <div
          className={`w-full flex justify-center items-center my-2 sm:my-3 ${className}`}
          data-placement-type="HEADER_BANNER"
        >
          <AdSlot
            placement="HEADER_BANNER"
            utilitySlug={utilitySlug}
            categorySlug={categorySlug}
            className="w-full"
          />
        </div>
      );

    case 'TOP_CONTENT':
      return (
        <div
          className={`w-full flex justify-center items-center my-3 ${className}`}
          data-placement-type="TOP_CONTENT"
        >
          <AdSlot
            placement="TOP_CONTENT"
            utilitySlug={utilitySlug}
            categorySlug={categorySlug}
            className="w-full"
          />
        </div>
      );

    case 'AFTER_TOOL':
      return (
        <div
          className={`w-full flex justify-center items-center my-4 ${className}`}
          data-placement-type="AFTER_TOOL"
        >
          <AdSlot
            placement="AFTER_TOOL"
            utilitySlug={utilitySlug}
            categorySlug={categorySlug}
            className="w-full"
          />
        </div>
      );

    case 'MID_CONTENT':
      return (
        <div
          className={`w-full flex justify-center items-center my-4 ${className}`}
          data-placement-type="MID_CONTENT"
        >
          <AdSlot
            placement="MID_CONTENT"
            utilitySlug={utilitySlug}
            categorySlug={categorySlug}
            className="w-full"
          />
        </div>
      );

    case 'BOTTOM_CONTENT':
      return (
        <div
          className={`w-full flex justify-center items-center my-4 sm:my-6 ${className}`}
          data-placement-type="BOTTOM_CONTENT"
        >
          <AdSlot
            placement="BOTTOM_CONTENT"
            utilitySlug={utilitySlug}
            categorySlug={categorySlug}
            className="w-full"
          />
        </div>
      );

    case 'SIDEBAR':
      // Canonical Desktop Right Column (Desktop: visible, Tablet/Mobile: hidden)
      return (
        <div
          className={`hidden lg:block w-full max-w-[300px] sticky top-24 ${className}`}
          data-placement-type="SIDEBAR"
        >
          <AdSlot
            placement="SIDEBAR"
            utilitySlug={utilitySlug}
            categorySlug={categorySlug}
            className="w-full"
          />
        </div>
      );

    case 'MOBILE_STICKY':
      // Canonical Mobile Bottom Sticky (Mobile: visible, Desktop: hidden)
      return (
        <aside
          aria-label="Sponsored Mobile Sticky Advertisement"
          className={`fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center pb-2 px-2 md:hidden ${className}`}
          data-placement-type="MOBILE_STICKY"
        >
          <div className="pointer-events-auto max-w-[320px] w-full">
            <AdSlot
              placement="MOBILE_STICKY"
              utilitySlug={utilitySlug}
              categorySlug={categorySlug}
              className="my-0 shadow-2xl border-slate-300"
            />
          </div>
        </aside>
      );

    case 'DESKTOP_STICKY':
      // Canonical Desktop Corner Sticky (Desktop: visible, Tablet/Mobile: hidden)
      return (
        <aside
          aria-label="Sponsored Desktop Corner Advertisement"
          className={`hidden xl:block fixed bottom-4 right-4 z-20 pointer-events-none max-w-[300px] ${className}`}
          data-placement-type="DESKTOP_STICKY"
        >
          <div className="pointer-events-auto shadow-xl rounded-2xl overflow-hidden">
            <AdSlot
              placement="DESKTOP_STICKY"
              utilitySlug={utilitySlug}
              categorySlug={categorySlug}
              className="my-0"
            />
          </div>
        </aside>
      );

    default:
      return null;
  }
};
