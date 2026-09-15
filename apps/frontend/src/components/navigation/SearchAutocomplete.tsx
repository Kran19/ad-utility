'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  X,
  ArrowRight,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Type,
  Code2,
  Video,
  Music,
  QrCode,
  Layers,
} from 'lucide-react';
import { searchToolsCatalog, ToolCatalogItem, ALL_TOOLS_CATALOG } from '../../lib/tools-catalog';

interface SearchAutocompleteProps {
  variant?: 'navbar-desktop' | 'navbar-mobile' | 'hero';
  placeholder?: string;
  onSelect?: () => void;
  onQueryChange?: (query: string) => void;
  initialQuery?: string;
  className?: string;
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  variant = 'navbar-desktop',
  placeholder = 'Search tools (e.g. PDF, Image, QR, AI)...',
  onSelect,
  onQueryChange,
  initialQuery = '',
  className = '',
}) => {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external initialQuery if it changes
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (onQueryChange) {
      onQueryChange(val);
    }
  };

  // Filter tools with high relevance
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return searchToolsCatalog(query, 7);
  }, [query]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(-1);
    if (query.trim().length > 0) {
      setIsOpen(true);
    }
  }, [query]);

  const handleSelectTool = (tool: ToolCatalogItem) => {
    setIsOpen(false);
    setQuery('');
    if (onSelect) onSelect();
    router.push(`/${tool.slug}`);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      handleSelectTool(suggestions[selectedIndex]);
      return;
    }
    if (query.trim()) {
      setIsOpen(false);
      if (onSelect) onSelect();
      router.push(`/?q=${encodeURIComponent(query.trim())}#tools`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && query.trim()) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getCategoryIcon = (categorySlug: string) => {
    switch (categorySlug) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-rose-500" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'text':
        return <Type className="w-4 h-4 text-emerald-600" />;
      case 'developer':
        return <Code2 className="w-4 h-4 text-purple-600" />;
      case 'ai':
        return <Sparkles className="w-4 h-4 text-blue-600" />;
      case 'video':
        return <Video className="w-4 h-4 text-amber-500" />;
      case 'audio':
        return <Music className="w-4 h-4 text-pink-500" />;
      case 'qr-barcode':
        return <QrCode className="w-4 h-4 text-cyan-600" />;
      default:
        return <Layers className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryBadgeClass = (categorySlug: string) => {
    switch (categorySlug) {
      case 'image':
        return 'bg-rose-50 text-rose-700 border-rose-200/60';
      case 'pdf':
        return 'bg-red-50 text-red-700 border-red-200/60';
      case 'text':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'developer':
        return 'bg-purple-50 text-purple-700 border-purple-200/60';
      case 'ai':
        return 'bg-blue-50 text-blue-700 border-blue-200/60';
      case 'video':
        return 'bg-amber-50 text-amber-700 border-amber-200/60';
      case 'audio':
        return 'bg-pink-50 text-pink-700 border-pink-200/60';
      case 'qr-barcode':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200/60';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/60';
    }
  };

  // Helper to highlight matching text query
  const highlightMatch = (text: string, match: string) => {
    if (!match.trim()) return text;
    const regex = new RegExp(`(${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="text-blue-600 font-bold bg-blue-50 px-0.5 rounded">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </>
    );
  };

  const isMobile = variant === 'navbar-mobile';
  const isHero = variant === 'hero';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Form */}
      <form onSubmit={handleFormSubmit} className="relative w-full">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (query.trim().length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
              isHero
                ? 'pl-11 pr-10 py-3.5 rounded-2xl bg-white border border-slate-200 shadow-md text-sm font-medium focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500'
                : isMobile
                ? 'pl-3.5 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 focus:bg-white'
                : 'w-64 xl:w-72 pl-8 pr-8 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-medium focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 focus:bg-white focus:w-80'
            }`}
          />

          {/* Left search icon (Hero and Desktop) */}
          {isHero && (
            <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
          )}
          {!isHero && !isMobile && (
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          )}

          {/* Right Action Icons (Clear / Submit) */}
          <div className="absolute right-2.5 flex items-center gap-1">
            {query.trim() && (
              <button
                type="button"
                onClick={() => {
                  handleInputChange('');
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="p-1 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
              title="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && query.trim() && (
        <div
          className={`absolute left-0 right-0 z-50 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 ${
            isMobile ? 'w-full max-h-[340px]' : isHero ? 'w-full max-h-[380px]' : 'min-w-[320px] max-h-[360px]'
          }`}
        >
          {suggestions.length > 0 ? (
            <div className="py-2 overflow-y-auto max-h-[320px] custom-scrollbar divide-y divide-slate-100">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Matching Tools ({suggestions.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">Use ↑ ↓ to navigate</span>
              </div>

              {suggestions.map((tool, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={tool.slug}
                    onClick={() => handleSelectTool(tool)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80 text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
                        {getCategoryIcon(tool.categorySlug)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {highlightMatch(tool.name, query)}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[280px] sm:max-w-md">
                          {tool.description}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
                          tool.categorySlug,
                        )}`}
                      >
                        {tool.categoryName.replace(' Tools', '').replace(' Utilities', '')}
                      </span>
                      <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                    </div>
                  </div>
                );
              })}

              {/* View all matching results option */}
              <div
                onClick={handleFormSubmit}
                className="p-2.5 bg-slate-50/80 hover:bg-blue-50 text-center cursor-pointer transition-colors border-t border-slate-100"
              >
                <span className="text-xs font-bold text-blue-600 hover:underline">
                  View all results for &ldquo;{query}&rdquo; &rarr;
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500">
              <p className="text-xs font-semibold text-slate-700">No tools found matching &ldquo;{query}&rdquo;</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Try searching for &quot;PDF&quot;, &quot;Compress&quot;, &quot;Convert&quot;, &quot;Image&quot;, or &quot;AI&quot;.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
