'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlanDto } from '@ad-utility/shared';

function PricingContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const statusParam = searchParams.get('status');

  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Check if returning from checkout session
    if (statusParam === 'success' && sessionId) {
      // Recommendation #7: Authoritative webhook confirmation state
      setNotice(
        'Payment received — subscription confirmation is pending backend verification. Your entitlements will activate automatically within a few moments.',
      );
    }

    async function fetchPlans() {
      try {
        const res = await fetch('http://localhost:4001/api/v1/billing/plans');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setPlans(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch public plans:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, [sessionId, statusParam]);

  const handleSelectPlan = async (planCode: string) => {
    if (planCode === 'FREE') {
      window.location.href = '/';
      return;
    }

    setCheckoutLoading(planCode);
    try {
      // Get auth token from storage or cookie
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      if (!token) {
        // Redirect to login or provide demo notice
        window.location.href = `/admin/login?redirect=/pricing`;
        return;
      }

      const res = await fetch('http://localhost:4001/api/v1/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planCode,
          successUrl: window.location.origin + '/pricing?status=success',
          cancelUrl: window.location.origin + '/pricing?status=canceled',
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
      } else {
        alert(json.message || 'Unable to initiate checkout. Please try again.');
      }
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm shadow-md">
              ⚡
            </span>
            <span>UtilityPlatform</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">
              All Utilities
            </Link>
            <Link href="/account/billing" className="text-sm text-slate-400 hover:text-white transition">
              My Subscription
            </Link>
            <Link
              href="/admin"
              className="text-xs px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Admin Panel
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Banner / Notice */}
        {notice && (
          <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-semibold">Authoritative Confirmation Pending</p>
              <p className="text-amber-200/80">{notice}</p>
            </div>
          </div>
        )}

        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-slate-400">
            Enjoy full access to our fast, privacy-safe utilities. Choose Free or unlock ad-free
            performance with Premium.
          </p>
        </div>

        {/* Pricing Cards */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan Card */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-8 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Free</h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                    Always Free
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-6">
                  Standard access to all utilities with community advertising and basic daily quotas.
                </p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-slate-500 text-sm">/ forever</span>
                </div>

                <div className="space-y-3 border-t border-slate-800/80 pt-6">
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>16+ Production Utilities</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>10 AI Requests / day</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>50 File Conversions / day</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-slate-500 font-bold">ℹ</span>
                    <span>Standard Community Ads</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan('FREE')}
                className="mt-8 w-full py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-white text-sm font-semibold transition"
              >
                Use Free
              </button>
            </div>

            {/* Premium Plan Card */}
            <div className="rounded-2xl bg-gradient-to-b from-indigo-950/40 to-slate-900 border-2 border-indigo-500/60 p-8 flex flex-col justify-between shadow-2xl relative">
              <div className="absolute -top-3.5 right-6 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white shadow">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Premium</h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Full Power
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-6">
                  Experience lightning-fast utility execution without advertisements and 20x higher limits.
                </p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-white">$9.99</span>
                  <span className="text-slate-400 text-sm">/ month</span>
                </div>

                <div className="space-y-3 border-t border-slate-800/80 pt-6">
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <span className="text-indigo-400 font-bold">★</span>
                    <span className="font-semibold text-white">100% Ad-Free Experience</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Exclusive Premium-Only Utilities</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>200 AI Requests / day (20x)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>1,000 File Conversions / day (20x)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Priority Server Processing Queue</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan('PREMIUM')}
                disabled={checkoutLoading === 'PREMIUM'}
                className="mt-8 w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
              >
                {checkoutLoading === 'PREMIUM' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Initiating Checkout...</span>
                  </>
                ) : (
                  <span>Upgrade to Premium</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security & Privacy Guarantee */}
        <div className="mt-16 p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center max-w-3xl mx-auto">
          <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
            🔒 Privacy & Payment Security Guarantee
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            All checkouts utilize provider-hosted tokenization and secure sessions. We never store, process,
            or access raw credit card numbers or CVV codes. Subscriptions can be canceled at any time with
            one click.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}
