'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserBillingOverviewDto } from '@ad-utility/shared';

export default function AccountBillingPage() {
  const [overview, setOverview] = useState<UserBillingOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBilling = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('http://localhost:4001/api/v1/billing/subscription/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setOverview(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load user billing overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handlePortalSession = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:4001/api/v1/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.portalUrl) {
        window.location.href = json.data.portalUrl;
      } else {
        setMessage({ type: 'error', text: json.message || 'Unable to open portal.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your Premium subscription? Your benefits will remain active until the end of the current billing cycle.')) {
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:4001/api/v1/billing/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ atPeriodEnd: true }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          type: 'success',
          text: 'Subscription scheduled for cancellation at the end of the current billing period.',
        });
        await fetchBilling();
      } else {
        setMessage({ type: 'error', text: json.message || 'Cancellation failed.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm shadow">
              ⚡
            </span>
            <span>UtilityPlatform</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition">
              Plans & Pricing
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">
              Utilities
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Account & Billing
          </h1>
          <p className="text-sm text-slate-400">
            Manage your subscription tier, entitlements, and daily utility usage quotas.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm border flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{message.type === 'success' ? '✓' : '⚠'}</span>
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !overview ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center">
            <p className="text-slate-400 mb-4 text-sm">
              Please sign in to view your subscription details and usage limits.
            </p>
            <Link
              href="/admin/login?redirect=/account/billing"
              className="inline-block px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Current Plan Card */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 md:p-8 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-white">{overview.plan.name}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        overview.isPremium
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {overview.subscription?.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {overview.isPremium
                      ? 'Ad-free experience with maximum processing priority and 20x quotas.'
                      : 'Standard tier with community advertising and basic daily quotas.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {overview.isPremium ? (
                    <>
                      <button
                        onClick={handlePortalSession}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                      >
                        Manage Billing
                      </button>
                      {overview.subscription && !overview.subscription.cancelAtPeriodEnd && (
                        <button
                          onClick={handleCancelSubscription}
                          disabled={actionLoading}
                          className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  ) : (
                    <Link
                      href="/pricing"
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition"
                    >
                      Upgrade to Premium
                    </Link>
                  )}
                </div>
              </div>

              {/* Subscription Details Meta */}
              {overview.subscription && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-1">Billing Interval</span>
                    <span className="font-semibold text-slate-200">
                      {overview.plan.billingInterval || 'Monthly'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Renewal / End Date</span>
                    <span className="font-semibold text-slate-200">
                      {overview.subscription.currentPeriodEnd
                        ? new Date(overview.subscription.currentPeriodEnd).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Payment Provider</span>
                    <span className="font-semibold text-slate-200 uppercase">
                      {overview.subscription.provider}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Auto-Renew</span>
                    <span
                      className={`font-semibold ${
                        overview.subscription.cancelAtPeriodEnd
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {overview.subscription.cancelAtPeriodEnd ? 'Ends at cycle' : 'Enabled'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Daily Usage Quotas */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 md:p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Daily Usage Quotas</h3>
                  <p className="text-xs text-slate-400">
                    Usage resets automatically at midnight UTC.
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">
                  UTC Time
                </span>
              </div>

              <div className="space-y-6">
                {overview.usage.map((u) => {
                  const percent = Math.min(100, Math.round((u.currentCount / u.limit) * 100));
                  const label =
                    u.featureKey === 'dailyAiRequests'
                      ? 'AI Requests'
                      : u.featureKey === 'dailyConversions'
                      ? 'Utility File Conversions'
                      : u.featureKey;

                  return (
                    <div key={u.featureKey} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300">{label}</span>
                        <span className="text-slate-400 font-mono">
                          {u.currentCount} / {u.limit} ({u.remaining} remaining)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            percent > 90
                              ? 'bg-rose-500'
                              : percent > 60
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Included Entitlements */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 shadow-md text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider mb-4">
                Active Entitlements Summary
              </h4>
              <div className="grid sm:grid-cols-2 gap-3 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className={overview.entitlements.showAds ? 'text-amber-400' : 'text-emerald-400 font-bold'}>
                    {overview.entitlements.showAds ? 'ℹ' : '✓'}
                  </span>
                  <span>{overview.entitlements.showAds ? 'Advertisements enabled' : '100% Ad-Free active'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Full access to all registered public utilities</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Client-side and Server-side execution engines</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Zero individual tracking / privacy-safe analytics</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
