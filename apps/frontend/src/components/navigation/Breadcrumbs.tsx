import React from 'react';
import Link from 'next/link';
import { BreadcrumbItemDto } from '@ad-utility/shared';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
  items: BreadcrumbItemDto[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-xs text-slate-500 py-2 flex items-center ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={item.url} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 select-none" />}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-semibold text-slate-800 select-none"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.url}
                  className="text-slate-500 hover:text-blue-600 transition-colors font-medium"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
