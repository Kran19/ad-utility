'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  ChevronDown,
  Crown,
  Menu,
  X,
  Image,
  FileText,
  Type,
  Code2,
  Sparkles,
  Video,
  Music,
  QrCode,
  User,
  Zap,
  LogOut,
  CreditCard,
} from 'lucide-react';
import { AuthUserProfile } from '@ad-utility/shared';
import { getClientApiUrl } from '../../lib/site-config';
import { useUserAuth } from '../../context/user-auth-context';
import { SearchAutocomplete } from './SearchAutocomplete';

interface NavbarProps {
  categories?: Array<{
    slug: string;
    name: string;
    utilityCount: number;
    utilities?: Array<{ slug: string; name: string }>;
  }>;
}

export const Navbar: React.FC<NavbarProps> = ({ categories = [] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user: userProfile, logout, openAuthModal } = useUserAuth();

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toolsRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(e.target as Node)) {
        setIsCategoriesOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsUserMenuOpen(false);
      router.push('/login');
    }
  };

  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'image':
        return <Image className="w-4 h-4 text-rose-500" />;
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
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Logo & Main Nav */}
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-sm shadow-blue-500/30 group-hover:scale-105 transition-transform">
              U
            </div>
            <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight whitespace-nowrap">
              Utility<span className="text-blue-600">Platform</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Tools Dropdown */}
            <div ref={toolsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsToolsOpen(!isToolsOpen);
                  setIsCategoriesOpen(false);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isToolsOpen ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span>Tools</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {isToolsOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 grid gap-1 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Popular Utilities
                  </div>
                  {[
                    { name: 'PDF to Text Extractor', slug: 'pdf-to-text', category: 'pdf' },
                    { name: 'PDF Compressor', slug: 'pdf-compressor', category: 'pdf' },
                    { name: 'PDF Rotator', slug: 'pdf-rotator', category: 'pdf' },
                    { name: 'PDF Watermark', slug: 'pdf-watermark', category: 'pdf' },
                    { name: 'Image Cropper', slug: 'image-cropper', category: 'image' },
                    { name: 'Image Compressor', slug: 'image-compressor', category: 'image' },
                    { name: 'QR Code Generator', slug: 'qr-code-generator', category: 'qr-barcode' },
                    { name: 'Video Compressor', slug: 'video-compressor', category: 'video' },
                  ].map((item) => (
                    <Link
                      key={item.slug}
                      href={`/${item.slug}`}
                      onClick={() => setIsToolsOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                    >
                      <div className="p-1 rounded-md bg-slate-100">
                        {getCategoryIcon(item.category)}
                      </div>
                      <span>{item.name}</span>
                    </Link>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1.5">
                    <Link
                      href="/#tools"
                      onClick={() => setIsToolsOpen(false)}
                      className="block text-center py-1.5 text-xs font-bold text-blue-600 hover:underline"
                    >
                      View All 37+ Tools &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Categories Dropdown */}
            <div ref={categoriesRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsCategoriesOpen(!isCategoriesOpen);
                  setIsToolsOpen(false);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isCategoriesOpen ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span>Categories</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCategoriesOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCategoriesOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 grid gap-1 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Categories
                  </div>
                  {[
                    { name: 'Image Tools', slug: 'image' },
                    { name: 'PDF Tools', slug: 'pdf' },
                    { name: 'Text Tools', slug: 'text' },
                    { name: 'Developer Tools', slug: 'developer' },
                    { name: 'AI Utilities', slug: 'ai' },
                    { name: 'Video Tools', slug: 'video' },
                    { name: 'Audio Tools', slug: 'audio' },
                    { name: 'QR & Barcode', slug: 'qr-barcode' },
                  ].map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      onClick={() => setIsCategoriesOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                    >
                      <div className="p-1 rounded-md bg-slate-100">
                        {getCategoryIcon(cat.slug)}
                      </div>
                      <span>{cat.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>


            <Link
              href="/pricing"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
            >
              Pricing
            </Link>
          </nav>
        </div>

        {/* Right: Search + Theme Toggle + Sign in + Get Premium */}
        <div className="flex items-center gap-3">
          {/* Search bar with instant autocomplete suggestions */}
          <div className="hidden lg:block">
            <SearchAutocomplete variant="navbar-desktop" />
          </div>

          {/* Right Controls: Authenticated vs Anonymous */}
          {userProfile ? (
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Account Link Button */}
              <Link
                href="/account"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                <span>Workspace</span>
              </Link>

              {/* User Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-1 sm:gap-2 p-1 pl-1.5 sm:pl-2 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                    {(userProfile.firstName?.[0] || userProfile.email[0] || 'U').toUpperCase()}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-0.5 sm:mr-1" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {userProfile.firstName
                          ? `${userProfile.firstName} ${userProfile.lastName || ''}`
                          : userProfile.email.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{userProfile.email}</div>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/account"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <User className="w-4 h-4 text-slate-500" />
                        <span>Account & Workspace</span>
                      </Link>

                      <Link
                        href="/account/billing"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <CreditCard className="w-4 h-4 text-slate-500" />
                        <span>Billing & Plan</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Sign in button */}
              <button
                type="button"
                onClick={() => openAuthModal({ initialTab: 'login' })}
                className="text-xs font-semibold text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors btn-interactive cursor-pointer"
              >
                Sign in
              </button>

              {/* Sign up button */}
              <button
                type="button"
                onClick={() => openAuthModal({ initialTab: 'signup' })}
                className="hidden sm:inline-block text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-3 py-1.5 rounded-lg transition-colors btn-interactive shadow-2xs cursor-pointer"
              >
                Sign up
              </button>

              {/* Get Premium button */}
              <Link
                href="/pricing"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm shadow-blue-500/25 flex items-center gap-1.5 transition-all hover:scale-[1.03] active:scale-[0.97] btn-interactive"
              >
                <Crown className="w-3.5 h-3.5 fill-current" />
                <span>Get Premium</span>
              </Link>
            </div>
          )}

          {/* Mobile menu hamburger */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-all duration-300 active:scale-90"
          >
            <div className={`transition-transform duration-300 ease-spring ${mobileMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
              {mobileMenuOpen ? <X className="w-5 h-5 text-blue-600" /> : <Menu className="w-5 h-5" />}
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      <div
        className={`md:hidden fixed inset-0 top-16 bg-slate-950/25 backdrop-blur-[2px] transition-opacity duration-400 ease-spring pointer-events-none z-30 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Smooth Accordion Drawer */}
      <div
        className={`md:hidden mobile-drawer-wrapper relative z-40 bg-white border-b border-slate-200 shadow-xl ${
          mobileMenuOpen ? 'is-open' : ''
        }`}
      >
        <div className="mobile-drawer-content bg-white">
          <div className="px-4 py-4 space-y-3.5 bg-white">
            {/* Search bar with instant autocomplete suggestions */}
            <SearchAutocomplete
              variant="navbar-mobile"
              onSelect={() => setMobileMenuOpen(false)}
            />

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              {[
                { name: 'Image Tools', slug: 'image' },
                { name: 'PDF Tools', slug: 'pdf' },
                { name: 'Text Tools', slug: 'text' },
                { name: 'Developer Tools', slug: 'developer' },
                { name: 'AI Utilities', slug: 'ai' },
                { name: 'Video Tools', slug: 'video' },
                { name: 'Audio Tools', slug: 'audio' },
                { name: 'QR & Barcode', slug: 'qr-barcode' },
              ].map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/70 hover:border-blue-200/80 transition-all duration-200 active:scale-95 shadow-2xs"
                >
                  <div className="shrink-0">{getCategoryIcon(cat.slug)}</div>
                  <span className="truncate">{cat.name}</span>
                </Link>
              ))}
            </div>

            <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
              {userProfile ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {userProfile.email}
                    </div>
                    <div className="text-[11px] text-slate-500">Authenticated Member</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Link
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                    >
                      Account Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal({ initialTab: 'login' });
                    }}
                    className="text-xs font-semibold text-slate-700 hover:text-blue-600 py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal({ initialTab: 'signup' });
                    }}
                    className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-3.5 py-1.5 rounded-lg transition-all duration-200 active:scale-95 shadow-2xs cursor-pointer"
                  >
                    Create Free Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
