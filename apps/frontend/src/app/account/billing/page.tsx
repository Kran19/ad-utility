'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserBillingOverviewDto } from '@ad-utility/shared';
import { Navbar } from '../../../components/navigation/Navbar';
import { Footer } from '../../../components/navigation/Footer';
import { getClientApiUrl } from '../../../lib/site-config';
import { Check, ShieldCheck, Zap, Star, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';

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

      const apiUrl = getClientApiUrl();
      const res = await fetch(`${apiUrl}/billing/subscription/me`, {
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
      const apiUrl = getClientApiUrl();
      const res = await fetch(`${apiUrl}/billing/portal`, {
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
    if (
      !confirm(
        'Are you sure you want to cancel your Premium subscription? Your benefits will remain active until the end of the current billing cycle.',
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const apiUrl = getClientApiUrl();
      const res = await fetch(`${apiUrl}/billing/cancel`, {
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
    <div className="min-h-screen bg-[#FAFBFD] text-slate-900 font-sans flex flex-col">
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 sm:py-16">
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>SUBSCRIPTION & LIMITS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
            Account & Billing
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            Manage your subscription tier, entitlements, and daily utility usage quotas.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-2xl text-sm border flex items-center gap-3 shadow-xs ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !overview ? (
          <div className="rounded-3xl bg-white border border-slate-200/90 p-8 sm:p-12 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-4 shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Sign In Required</h3>
            <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">
              Please sign in to view your subscription details, active benefits, and usage limits.
            </p>
            <Link
              href="/admin/login?redirect=/account/billing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/25 transition"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Plan Card */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 md:p-8 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-black text-slate-900">{overview.plan.name}</h2>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        overview.isPremium
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {overview.subscription?.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {overview.isPremium
                      ? 'Ad-free experience with maximum processing priority and 20x quotas.'
                      : 'Standard tier with community advertising and basic daily quotas.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {overview.isPremium ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePortalSession}
                        disabled={actionLoading}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition shadow-xs"
                      >
                        Manage Billing
                      </button>
                      {overview.subscription && !overview.subscription.cancelAtPeriodEnd && (
                        <button
                          type="button"
                          onClick={handleCancelSubscription}
                          disabled={actionLoading}
                          className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  ) : (
                    <Link
                      href="/pricing"
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition flex items-center gap-1.5"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>Upgrade to Premium</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Subscription Details Meta */}
              {overview.subscription && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1 font-bold uppercase tracking-wider text-[10px]">
                      Billing Interval
                    </span>
                    <span className="font-bold text-slate-800">
                      {overview.plan.billingInterval || 'Monthly'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1 font-bold uppercase tracking-wider text-[10px]">
                      Renewal Date
                    </span>
                    <span className="font-bold text-slate-800 font-mono">
                      {overview.subscription.currentPeriodEnd
                        ? new Date(overview.subscription.currentPeriodEnd).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1 font-bold uppercase tracking-wider text-[10px]">
                      Provider
                    </span>
                    <span className="font-bold text-slate-800 uppercase font-mono">
                      {overview.subscription.provider}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1 font-bold uppercase tracking-wider text-[10px]">
                      Auto-Renew
                    </span>
                    <span
                      className={`font-bold ${
                        overview.subscription.cancelAtPeriodEnd ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {overview.subscription.cancelAtPeriodEnd ? 'Ends at cycle' : 'Enabled'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Daily Usage Quotas */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Daily Usage Quotas</h3>
                  <p className="text-xs text-slate-500">Usage resets automatically at midnight UTC.</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                  UTC Midnight Reset
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
                        <span className="font-bold text-slate-800">{label}</span>
                        <span className="text-slate-500 font-mono font-medium">
                          {u.currentCount} / {u.limit} ({u.remaining} remaining)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            percent > 90
                              ? 'bg-rose-500'
                              : percent > 60
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
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
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm text-xs space-y-4">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider">
                Active Entitlements Summary
              </h4>
              <div className="grid sm:grid-cols-2 gap-3 text-slate-700 font-medium">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 flex items-center justify-center font-bold ${
                      overview.entitlements.showAds ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {overview.entitlements.showAds ? 'ℹ' : '✓'}
                  </span>
                  <span>{overview.entitlements.showAds ? 'Advertisements enabled' : '100% Ad-Free active'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center text-emerald-600 font-bold">✓</span>
                  <span>Full access to all registered public utilities</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center text-emerald-600 font-bold">✓</span>
                  <span>Client-side and Server-side execution engines</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center text-emerald-600 font-bold">✓</span>
                  <span>Zero individual tracking / privacy-safe analytics</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
