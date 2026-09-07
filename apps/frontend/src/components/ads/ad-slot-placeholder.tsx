import React from 'react';
import { AdPlacement } from '@ad-utility/shared';

interface AdSlotPlaceholderProps {
  placement: AdPlacement;
  className?: string;
}

const PLACEMENT_DIMENSIONS: Record<AdPlacement, { label: string; height: string; maxWidth?: string }> = {
  HEADER_BANNER: { label: 'Header Banner (728x90 / 320x50)', height: 'h-[90px]', maxWidth: 'max-w-[728px]' },
  TOP_CONTENT: { label: 'Top Content Banner (728x90)', height: 'h-[90px]', maxWidth: 'max-w-[728px]' },
  AFTER_TOOL: { label: 'After Tool Banner (728x90 / 300x250)', height: 'h-[90px]', maxWidth: 'max-w-[728px]' },
  MID_CONTENT: { label: 'Mid Content Banner (728x90)', height: 'h-[90px]', maxWidth: 'max-w-[728px]' },
  BOTTOM_CONTENT: { label: 'Bottom Content Banner (728x90)', height: 'h-[90px]', maxWidth: 'max-w-[728px]' },
  SIDEBAR: { label: 'Sidebar Banner (300x250 / 160x600)', height: 'h-[250px]', maxWidth: 'max-w-[300px]' },
  MOBILE_STICKY: { label: 'Mobile Sticky Footer (320x50)', height: 'h-[50px]', maxWidth: 'max-w-[320px]' },
  DESKTOP_STICKY: { label: 'Desktop Corner Sticky (300x250)', height: 'h-[250px]', maxWidth: 'max-w-[300px]' },
};

export const AdSlotPlaceholder: React.FC<AdSlotPlaceholderProps> = ({ placement, className = '' }) => {
  const config = PLACEMENT_DIMENSIONS[placement] || {
    label: `Ad Slot: ${placement}`,
    height: 'h-[90px]',
    maxWidth: 'max-w-full',
  };

  return (
    <div
      data-ad-placement={placement}
      className={`w-full mx-auto my-4 flex items-center justify-center rounded-lg border border-dashed border-gray-700/60 bg-gray-900/40 text-gray-400 text-xs font-mono select-none overflow-hidden transition-all duration-200 ${config.height} ${config.maxWidth} ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/60 rounded border border-gray-700/40">
        <span className="w-2 h-2 rounded-full bg-blue-500/80 animate-pulse"></span>
        <span>Ad Placement Placeholder &bull; {config.label}</span>
      </div>
    </div>
  );
};
