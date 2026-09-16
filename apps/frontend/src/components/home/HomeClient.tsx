'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { CategoryPublicDto, UtilityPublicDto } from '@ad-utility/shared';
import {
  Search,
  ShieldCheck,
  Zap,
  Heart,
  Image as ImageIcon,
  FileText,
  Type,
  Code2,
  Sparkles,
  Video,
  Music,
  QrCode,
  Crop,
  Layers,
  RotateCw,
  Stamp,
  Scissors,
  FileSpreadsheet,
  Maximize2,
  KeyRound,
  FileCheck,
  Minimize2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { AdPlacementSlot } from '../ads/ad-placement-slot';
import { SearchAutocomplete } from '../navigation/SearchAutocomplete';

interface HomeClientProps {
  categories: CategoryPublicDto[];
  totalTools: number;
}

export const HomeClient: React.FC<HomeClientProps> = ({ categories, totalTools }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Smooth scroll to the tools directory section
  const scrollToTools = () => {
    setTimeout(() => {
      const toolsSection = document.getElementById('tools');
      if (toolsSection) {
        const navHeight = 75; // Account for fixed/sticky navbar height
        const targetPos = toolsSection.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({
          top: Math.max(0, targetPos),
          behavior: 'smooth',
        });
      }
    }, 50);
  };

  // Helper for category metadata styling
  const getCategoryMeta = (slug: string) => {
    switch (slug) {
      case 'image':
        return {
          icon: <ImageIcon className="w-5 h-5 text-rose-500" />,
          badgeIcon: <ImageIcon className="w-4 h-4 text-rose-500" />,
          bg: 'bg-rose-50',
          border: 'border-rose-100',
          text: 'text-rose-600',
        };
      case 'pdf':
        return {
          icon: <FileText className="w-5 h-5 text-red-500" />,
          badgeIcon: <FileText className="w-4 h-4 text-red-500" />,
          bg: 'bg-red-50',
          border: 'border-red-100',
          text: 'text-red-600',
        };
      case 'text':
        return {
          icon: <Type className="w-5 h-5 text-emerald-600" />,
          badgeIcon: <Type className="w-4 h-4 text-emerald-600" />,
          bg: 'bg-emerald-50',
          border: 'border-emerald-100',
          text: 'text-emerald-600',
        };
      case 'developer':
        return {
          icon: <Code2 className="w-5 h-5 text-purple-600" />,
          badgeIcon: <Code2 className="w-4 h-4 text-purple-600" />,
          bg: 'bg-purple-50',
          border: 'border-purple-100',
          text: 'text-purple-600',
        };
      case 'ai':
        return {
          icon: <Sparkles className="w-5 h-5 text-blue-600" />,
          badgeIcon: <Sparkles className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-50',
          border: 'border-blue-100',
          text: 'text-blue-600',
        };
      case 'video':
        return {
          icon: <Video className="w-5 h-5 text-amber-600" />,
          badgeIcon: <Video className="w-4 h-4 text-amber-600" />,
          bg: 'bg-amber-50',
          border: 'border-amber-100',
          text: 'text-amber-600',
        };
      case 'audio':
        return {
          icon: <Music className="w-5 h-5 text-pink-600" />,
          badgeIcon: <Music className="w-4 h-4 text-pink-600" />,
          bg: 'bg-pink-50',
          border: 'border-pink-100',
          text: 'text-pink-600',
        };
      case 'qr-barcode':
        return {
          icon: <QrCode className="w-5 h-5 text-cyan-600" />,
          badgeIcon: <QrCode className="w-4 h-4 text-cyan-600" />,
          bg: 'bg-cyan-50',
          border: 'border-cyan-100',
          text: 'text-cyan-600',
        };
      default:
        return {
          icon: <FileText className="w-5 h-5 text-blue-500" />,
          badgeIcon: <FileText className="w-4 h-4 text-blue-500" />,
          bg: 'bg-blue-50',
          border: 'border-blue-100',
          text: 'text-blue-600',
        };
    }
  };

  // Helper for tailored tool card icons & colors
  const getToolIcon = (slug: string) => {
    switch (slug) {
      case 'jpg-to-png':
        return { icon: <ImageIcon className="w-5 h-5 text-cyan-500" />, bg: 'bg-cyan-50 border-cyan-100' };
      case 'png-to-jpg':
        return { icon: <ImageIcon className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50 border-orange-100' };
      case 'image-compressor':
        return { icon: <Minimize2 className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50 border-blue-100' };
      case 'image-to-pdf':
        return { icon: <FileText className="w-5 h-5 text-rose-500" />, bg: 'bg-rose-50 border-rose-100' };
      case 'image-resizer':
        return { icon: <Maximize2 className="w-5 h-5 text-teal-600" />, bg: 'bg-teal-50 border-teal-100' };
      case 'image-cropper':
        return { icon: <Crop className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50 border-indigo-100' };
      case 'webp-to-jpg':
        return { icon: <ImageIcon className="w-5 h-5 text-sky-600" />, bg: 'bg-sky-50 border-sky-100' };
      case 'jpg-to-webp':
        return { icon: <ImageIcon className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50 border-purple-100' };
      case 'png-to-webp':
        return { icon: <ImageIcon className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-100' };

      case 'pdf-compressor':
        return { icon: <Minimize2 className="w-5 h-5 text-red-500" />, bg: 'bg-red-50 border-red-100' };
      case 'pdf-merge':
        return { icon: <Layers className="w-5 h-5 text-rose-600" />, bg: 'bg-rose-50 border-rose-100' };
      case 'pdf-split':
        return { icon: <Scissors className="w-5 h-5 text-pink-600" />, bg: 'bg-pink-50 border-pink-100' };
      case 'pdf-to-jpg':
        return { icon: <ImageIcon className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50 border-orange-100' };
      case 'pdf-to-png':
        return { icon: <ImageIcon className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50 border-blue-100' };
      case 'pdf-to-text':
        return { icon: <Type className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50 border-purple-100' };
      case 'pdf-page-extractor':
        return { icon: <Layers className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50 border-indigo-100' };
      case 'pdf-rotator':
        return { icon: <RotateCw className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-100' };
      case 'pdf-reorder-pages':
        return { icon: <Layers className="w-5 h-5 text-violet-600" />, bg: 'bg-violet-50 border-violet-100' };
      case 'pdf-watermark':
        return { icon: <Stamp className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50 border-amber-100' };
      case 'pdf-metadata-remover':
        return { icon: <ShieldCheck className="w-5 h-5 text-sky-600" />, bg: 'bg-sky-50 border-sky-100' };

      case 'word-counter':
        return { icon: <Type className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-100' };
      case 'text-cleaner':
        return { icon: <Type className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50 border-amber-100' };
      case 'case-converter':
        return { icon: <Type className="w-5 h-5 text-green-600" />, bg: 'bg-green-50 border-green-100' };

      case 'json-formatter':
        return { icon: <Code2 className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50 border-purple-100' };
      case 'text-hash':
        return { icon: <Lock className="w-5 h-5 text-violet-600" />, bg: 'bg-violet-50 border-violet-100' };

      case 'ai-summarizer':
        return { icon: <Sparkles className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50 border-blue-100' };
      case 'ai-humanizer':
        return { icon: <Sparkles className="w-5 h-5 text-sky-600" />, bg: 'bg-sky-50 border-sky-100' };
      case 'ai-paraphraser':
        return { icon: <Sparkles className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50 border-purple-100' };
      case 'ai-grammar-checker':
        return { icon: <FileCheck className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-100' };

      case 'video-compressor':
        return { icon: <Video className="w-5 h-5 text-red-500" />, bg: 'bg-red-50 border-red-100' };
      case 'mp4-to-mp3':
        return { icon: <Music className="w-5 h-5 text-rose-500" />, bg: 'bg-rose-50 border-rose-100' };
      case 'video-to-gif':
        return { icon: <Video className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50 border-orange-100' };
      case 'video-trimmer':
        return { icon: <Scissors className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50 border-amber-100' };

      case 'audio-cutter':
        return { icon: <Music className="w-5 h-5 text-pink-600" />, bg: 'bg-pink-50 border-pink-100' };

      case 'qr-code-generator':
        return { icon: <QrCode className="w-5 h-5 text-cyan-600" />, bg: 'bg-cyan-50 border-cyan-100' };
      case 'barcode-generator':
        return { icon: <QrCode className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-100' };

      default:
        return { icon: <FileText className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50 border-blue-100' };
    }
  };

  // Filter utilities across categories based on search & category filter
  const filteredCategories = useMemo(() => {
    let result = categories;

    if (selectedCategory) {
      result = result.filter((cat) => cat.slug === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result
        .map((cat) => {
          const matchingUtils = cat.utilities.filter(
            (u) =>
              u.name.toLowerCase().includes(q) ||
              u.slug.toLowerCase().includes(q) ||
              u.description.toLowerCase().includes(q),
          );
          return {
            ...cat,
            utilities: matchingUtils,
            utilityCount: matchingUtils.length,
          };
        })
        .filter((cat) => cat.utilities.length > 0);
    }

    return result;
  }, [categories, searchQuery, selectedCategory]);

  return (
    <div className="w-full">
      {/* Canonical Placement: HEADER_BANNER */}
      <AdPlacementSlot placement="HEADER_BANNER" utilitySlug="home" />

      {/* Placement 1: TOP_CONTENT */}
      <AdPlacementSlot placement="TOP_CONTENT" utilitySlug="home" />

      {/* Hero Section */}
      <section className="relative pt-6 sm:pt-10 pb-8 sm:pb-16 text-center max-w-4xl mx-auto px-4">
        {/* Playful Hand-drawn Annotation: Left */}
        <div className="hidden xl:block absolute -left-10 top-10 -rotate-6 text-slate-700 pointer-events-none select-none z-10 animate-float">
          <div className="relative font-handwriting text-sm leading-tight text-slate-800 font-bold tracking-wide text-left whitespace-nowrap">
            <span className="text-red-500 text-xs font-black absolute -top-2.5 -right-3 animate-pulse">✦</span>
            Simple Tools
            <br />
            Big Possibilities
          </div>
        </div>

        {/* Playful Hand-drawn Annotation: Right with Curved Arrow */}
        <div className="hidden xl:block absolute -right-10 top-6 rotate-3 text-slate-700 pointer-events-none select-none z-10 text-right animate-float-slow">
          <div className="font-handwriting text-sm leading-tight text-slate-800 font-bold tracking-wide whitespace-nowrap">
            Powerful tools
            <br />
            for everyday tasks
          </div>
          <svg
            className="w-16 h-12 text-slate-600 mt-1 ml-auto mr-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 60 45"
          >
            <path d="M 45 4 C 35 15, 20 28, 10 38" />
            <polyline points="4 32, 10 38, 18 34" />
          </svg>
        </div>

        {/* Pill Badge with subtle glow */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50/90 border border-blue-200/80 text-blue-600 text-xs font-bold shadow-xs mb-3 sm:mb-4 animate-fade-in hover:scale-105 transition-transform cursor-default">
          <span className="text-amber-500 text-xs animate-spin-slow">✨</span>
          <span>{totalTools > 0 ? `${totalTools}+ FREE TOOLS` : '38+ FREE TOOLS'}</span>
        </div>

        {/* Main Hero Headline */}
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.15] break-words animate-fade-in-up">
          Free, Fast & Secure <br />
          <span className="text-blue-600 font-extrabold inline-block mt-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
            Online Web Utilities
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm md:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed mt-2.5 sm:mt-4 font-normal px-2 animate-fade-in-up animate-delay-100">
          Everyday utilities for images, PDFs, text, and AI writing. Zero software installation required. Direct
          in-browser and server-accelerated processing with total privacy.
        </p>

        {/* Hero Search Box with Instant Autocomplete */}
        <div className="mt-5 sm:mt-8 max-w-2xl mx-auto animate-fade-in-up animate-delay-200">
          <SearchAutocomplete
            variant="hero"
            placeholder="Search 38+ tools (e.g. merge PDF, resize, QR, AI)..."
            initialQuery={searchQuery}
            onQueryChange={(val) => setSearchQuery(val)}
          />
        </div>

        {/* Value Props Row: Seamless 3-item responsive grid */}
        <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto text-center sm:text-left animate-fade-in-up animate-delay-300">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 bg-white/90 backdrop-blur-xs p-2 sm:px-3.5 sm:py-2 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all duration-300">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">100% Private</p>
              <p className="hidden sm:block text-[10px] text-slate-500">Your files stay secure</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 bg-white/90 backdrop-blur-xs p-2 sm:px-3.5 sm:py-2 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-200 hover:shadow-md transition-all duration-300">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">Super Fast</p>
              <p className="hidden sm:block text-[10px] text-slate-500">Optimized speed</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2.5 bg-white/90 backdrop-blur-xs p-2 sm:px-3.5 sm:py-2 rounded-2xl border border-slate-200/80 shadow-xs hover:border-pink-200 hover:shadow-md transition-all duration-300">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">Always Free</p>
              <p className="hidden sm:block text-[10px] text-slate-500">No sign-up needed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Browse by Category Section */}
      <section id="categories" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Browse by Category</h2>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              scrollToTools();
            }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 btn-interactive"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat.slug);
            const isSelected = selectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedCategory(null);
                  } else {
                    setSelectedCategory(cat.slug);
                    scrollToTools();
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between group cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-500/20 scale-[1.02]'
                    : 'bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${meta.bg} ${meta.border} border flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                  {meta.icon}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {cat.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {cat.utilityCount} {cat.utilityCount === 1 ? 'tool' : 'tools'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* All Online Tools Directory Grouped by Category */}
      <section id="tools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 scroll-mt-20 sm:scroll-mt-24">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">All Online Tools</h2>
          <p className="text-xs text-slate-500 mt-1">
            Select any utility below to launch the dedicated workspace.
          </p>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-white border border-slate-200 rounded-2xl animate-fade-in">
            <p className="text-base font-semibold text-slate-700">No matching utilities found</p>
            <p className="text-xs text-slate-500">Try searching with a different term like &ldquo;PDF&rdquo;, &ldquo;Image&rdquo;, or &ldquo;QR&rdquo;.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(null);
                scrollToTools();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm btn-interactive"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const meta = getCategoryMeta(cat.slug);
            return (
              <React.Fragment key={cat.slug}>
                <div className="space-y-4">
                  {/* Category Header Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl ${meta.bg} ${meta.border} border flex items-center justify-center shrink-0 shadow-2xs`}>
                        {meta.badgeIcon}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{cat.name}</span>
                        <span className="text-xs font-normal text-slate-500">({cat.utilities.length})</span>
                      </h3>
                    </div>
                    <Link
                      href={`/category/${cat.slug}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 btn-interactive"
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* 3-column Grid of Individual Tool Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {cat.utilities.map((util) => {
                      const toolIconMeta = getToolIcon(util.slug);
                      return (
                        <Link
                          key={util.slug}
                          href={`/${util.slug}`}
                          className="tool-card group p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:bg-gradient-to-br hover:from-white hover:to-blue-50/20 flex items-start gap-3.5"
                        >
                          {/* Tool Icon Box */}
                          <div className={`w-10 h-10 rounded-xl ${toolIconMeta.bg} border flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-2xs`}>
                            {toolIconMeta.icon}
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {util.name}
                              </h4>
                              {util.isFeatured && (
                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-full shrink-0 shadow-2xs">
                                  ★ Featured
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 leading-snug line-clamp-2 mt-0.5 group-hover:text-slate-600 transition-colors">
                              {util.description}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* In-feed Ad after PDF Tools (MID_CONTENT) */}
                {cat.slug === 'pdf' && (
                  <div className="my-6">
                    <AdPlacementSlot placement="MID_CONTENT" utilitySlug="home" />
                  </div>
                )}

                {/* In-feed Ad after Video Tools (AFTER_TOOL) */}
                {cat.slug === 'video' && (
                  <div className="my-6">
                    <AdPlacementSlot placement="AFTER_TOOL" utilitySlug="home" />
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </section>

      {/* Canonical Placement #5: BOTTOM_CONTENT */}
      <AdPlacementSlot placement="BOTTOM_CONTENT" utilitySlug="home" />

      {/* Floating Sticky Overlays (Active only if targeted in Admin) */}
      <AdPlacementSlot placement="MOBILE_STICKY" utilitySlug="home" />
      <AdPlacementSlot placement="DESKTOP_STICKY" utilitySlug="home" />
    </div>
  );
};
