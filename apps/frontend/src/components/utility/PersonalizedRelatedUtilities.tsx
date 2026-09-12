'use client';

import React from 'react';
import Link from 'next/link';
import { usePersonalization } from '../../lib/use-personalization';
import { ArrowRight } from 'lucide-react';

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
    <section className="space-y-4 pt-6 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">{headline}</h3>
        <Link
          href={`/category/${categorySlug}`}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
        >
          <span>More in {categoryName}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {slugsToDisplay.map((relSlug) => (
          <Link
            key={relSlug}
            href={`/${relSlug}`}
            className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between group"
          >
            <span className="font-semibold text-xs text-slate-800 group-hover:text-blue-600 transition-colors capitalize">
              {relSlug.replace(/-/g, ' ')}
            </span>
            <span className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};
