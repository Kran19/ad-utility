'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthUserProfile } from '@ad-utility/shared';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';
import { getClientApiUrl } from '../../lib/site-config';
import {
  User,
  Zap,
  Sparkles,
  Crown,
  CreditCard,
  LogOut,
  ArrowRight,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Video,
  QrCode,
  Code2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const apiUrl = getClientApiUrl();
        const res = await fetch(`${apiUrl}/auth/me`, {
          credentials: 'include', // Use HTTP-only cookies
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setProfile(json.data);
          } else {
            router.push('/login?redirect=/account');
          }
        } else {
          router.push('/login?redirect=/account');
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        router.push('/login?redirect=/account');
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const apiUrl = getClientApiUrl();
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout request error:', err);
    } finally {
      window.location.href = '/login';
    }
  };

  const utilitiesLaunchpad = [
    {
      title: 'Video Downloader',
      category: 'Video',
      href: '/video-downloader',
      icon: Video,
      desc: 'Download videos from web URLs securely',
      color: 'text-amber-500 bg-amber-50',
    },
    {
      title: 'Image Converter',
      category: 'Image',
      href: '/image-converter',
      icon: ImageIcon,
      desc: 'Convert PNG, JPG, WEBP formats in bulk',
      color: 'text-rose-500 bg-rose-50',
    },
    {
      title: 'PDF Merge & Compress',
      category: 'PDF',
      href: '/pdf-merge',
      icon: FileText,
      desc: 'Combine and compress PDF documents',
      color: 'text-red-500 bg-red-50',
    },
    {
      title: 'AI Utilities',
      category: 'AI',
      href: '/ai-humanizer',
      icon: Sparkles,
      desc: 'Refine text, check grammar, and paraphrase with AI',
      color: 'text-blue-500 bg-blue-50',
    },
    {
      title: 'QR Code Generator',
      category: 'QR & Barcode',
      href: '/qr-generator',
      icon: QrCode,
      desc: 'Create custom QR codes with high error correction',
      color: 'text-cyan-600 bg-cyan-50',
    },
    {
      title: 'JSON Formatter',
      category: 'Developer',
      href: '/json-formatter',
      icon: Code2,
      desc: 'Validate, format, and minify JSON trees',
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-slate-200 rounded-xl w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-44 bg-slate-200 rounded-2xl" />
              <div className="h-44 bg-slate-200 rounded-2xl" />
            </div>
            <div className="h-64 bg-slate-200 rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) return null;

  const displayName =
    profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile.firstName || profile.email.split('@')[0];

  const initials =
    (profile.firstName?.[0] || profile.email[0] || 'U').toUpperCase() +
    (profile.lastName?.[0] || '').toUpperCase();

  const formattedDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active member';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md shadow-blue-500/20">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Welcome, {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Free Plan</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {profile.email} • Member since {formattedDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/account/billing"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
            >
              <CreditCard className="w-4 h-4 text-slate-600" />
              <span>Billing & Plan</span>
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 font-bold text-xs transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* 2 Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          
          {/* Card 1: Current Subscription Plan */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Current Plan Tier
                </div>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                  <Crown className="w-4 h-4" />
                </div>
              </div>

              <div className="mb-4">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  Free Workspace
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Unlimited access to 30+ web utilities with fast in-memory execution.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/pricing"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs text-center shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.01]"
              >
                Upgrade to Premium
              </Link>
            </div>
          </div>

          {/* Card 2: Security & Session */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Security & Workspace
                </div>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Authentication:</span>
                  <span className="font-semibold text-slate-800">Secure HTTP-only Session</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Account Status:</span>
                  <span className="font-semibold text-emerald-600">Active</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Account ID:</span>
                  <span className="font-mono text-slate-600 text-[11px] truncate max-w-[150px]">
                    {profile.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Privacy-first architecture: files are processed in-memory with zero persistent retention.
              </span>
            </div>
          </div>

        </div>

        {/* Utilities Launchpad Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Your Utility Launchpad
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Quick access to popular creative, document, and developer tools
              </p>
            </div>
            <Link
              href="/#tools"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <span>View All 30+ Tools</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {utilitiesLaunchpad.map((tool, idx) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={idx}
                  href={tool.href}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group flex items-start gap-4"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tool.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {tool.title}
                      </h3>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="inline-block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      {tool.category}
                    </span>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
