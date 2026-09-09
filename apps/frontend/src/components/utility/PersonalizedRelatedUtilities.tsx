'use client';

import React from 'react';
import Link from 'next/link';
import { usePersonalization } from '../../lib/use-personalization';

interface PersonalizedRelatedUtilitiesProps {
  utilitySlug: string;
  categorySlug: string;
  categoryName: string;
  initialRelatedSlugs: string[];
}

export const PersonalizedRelatedUtilities: React.FC<PersonalizedRelatedUtilitiesProps> = ({
  utilitySlug,
  categorySlug,
  categoryName,
  initialRelatedSlugs,
}) => {
  const decision = usePersonalization('RELATED_UTILITIES', {
    utilitySlug,
    categorySlug,
  });

  const slugsToDisplay =
    Array.isArray(decision.payload.recommendedSlugs) && decision.payload.recommendedSlugs.length > 0
      ? decision.payload.recommendedSlugs
      : initialRelatedSlugs;

  const headline = decision.payload.headline || 'Related Utilities';

  if (!slugsToDisplay || slugsToDisplay.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 pt-4 border-t border-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">{headline}</h3>
        <Link
          href={`/category/${categorySlug}`}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          More in {categoryName} &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slugsToDisplay.map((relSlug) => (
          <Link
            key={relSlug}
            href={`/${relSlug}`}
            className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900 transition-all flex items-center justify-between group"
          >
            <span className="font-medium text-slate-300 group-hover:text-blue-400 transition-colors capitalize">
              {relSlug.replace(/-/g, ' ')}
            </span>
            <span className="text-slate-500 group-hover:translate-x-1 transition-transform">&rarr;</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
