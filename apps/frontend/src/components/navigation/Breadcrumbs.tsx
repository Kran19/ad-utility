import React from 'react';
import Link from 'next/link';
import { BreadcrumbItemDto } from '@ad-utility/shared';

interface BreadcrumbsProps {
  items: BreadcrumbItemDto[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-sm text-gray-400 py-2 flex items-center ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={item.url} className="flex items-center gap-2">
              {idx > 0 && <span className="text-gray-600 select-none">/</span>}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-white select-none"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.url}
                  className="hover:text-blue-400 transition-colors"
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
