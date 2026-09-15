'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlanDto } from '@ad-utility/shared';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';
import { getClientApiUrl } from '../../lib/site-config';
import { Check, Sparkles, ShieldCheck, Zap, Star, HelpCircle, Lock, ArrowRight } from 'lucide-react';

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
      setNotice(
        'Payment received — subscription confirmation is pending backend verification. Your entitlements will activate automatically within a few moments.',
      );
    }

    async function fetchPlans() {
      try {
        const apiUrl = getClientApiUrl();
        const res = await fetch(`${apiUrl}/billing/plans`);
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
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      if (!token) {
        window.location.href = `/admin/login?redirect=/pricing`;
        return;
      }

      const apiUrl = getClientApiUrl();
      const res = await fetch(`${apiUrl}/billing/checkout`, {
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

  const faqs = [
    {
      q: 'Can I cancel my subscription anytime?',
      a: 'Yes! You can cancel your Premium subscription with a single click at any time from your account settings. You will retain full access until the end of your billing cycle.',
    },
    {
      q: 'Is my data and file upload safe?',
      a: 'Absolutely. We process files in-memory without persistent server storage. All file conversions are discarded immediately after processing.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept all major credit cards, debit cards, Apple Pay, Google Pay, and regional payment methods via secure Stripe processing.',
    },
    {
      q: 'What are the benefits of Premium?',
      a: 'Premium gives you an ad-free experience, 20x higher daily limits on conversions and AI tools, priority processing queue, and exclusive tools.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFBFD] text-slate-900 font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 sm:py-16">
        {/* Notice Banner */}
        {notice && (
          <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3 shadow-xs">
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-bold text-amber-900">Confirmation Pending</p>
              <p className="text-amber-800 text-xs mt-0.5">{notice}</p>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 animate-fade-in-up">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 mb-4 shadow-xs hover:scale-105 transition-transform cursor-default">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>TRANSPARENT & FAIR PRICING</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Enjoy full access to our fast, privacy-safe utilities. Choose Free or unlock ad-free
            performance with Premium.
          </p>
        </div>

        {/* Pricing Cards */}
        {loading ? (
          <div className="flex justify-center py-16 animate-fade-in">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch animate-fade-in-up animate-delay-100">
            {/* Free Plan Card */}
            <div className="tool-card rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold">
                      ⚡
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Free</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Always Free
                  </span>
                </div>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Standard access to all utilities with community advertising and basic daily quotas.
                </p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900">$0</span>
                  <span className="text-slate-500 text-sm font-medium">/ forever</span>
                </div>

                <div className="space-y-3.5 border-t border-slate-100 pt-6">
                  <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>16+ Production Utilities</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>10 AI Requests / day</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>50 File Conversions / day</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span className="w-4 h-4 text-center font-bold text-slate-400 text-xs shrink-0">ℹ</span>
                    <span>Standard Community Ads</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan('FREE')}
                className="mt-8 w-full py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold transition shadow-xs btn-interactive"
              >
                Use Free
              </button>
            </div>

            {/* Premium Plan Card */}
            <div className="tool-card rounded-3xl bg-gradient-to-b from-blue-50/60 via-white to-white border-2 border-blue-600 p-6 sm:p-8 flex flex-col justify-between shadow-lg shadow-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/20 transition-all relative">
              <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-600 text-white shadow-md shadow-blue-500/30 flex items-center gap-1 animate-pulse">
                <Star className="w-3 h-3 fill-current" />
                <span>Most Popular</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                      👑
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Premium</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    Full Power
                  </span>
                </div>
                <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                  Experience lightning-fast utility execution without advertisements and 20x higher limits.
                </p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900">$9.99</span>
                  <span className="text-slate-500 text-sm font-medium">/ month</span>
                </div>

                <div className="space-y-3.5 border-t border-blue-100 pt-6">
                  <div className="flex items-center gap-3 text-sm text-blue-950 font-bold bg-blue-50/80 p-2.5 rounded-xl border border-blue-200/60">
                    <Star className="w-4 h-4 text-blue-600 fill-blue-600 shrink-0" />
                    <span>100% Ad-Free Experience</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-800 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Exclusive Premium-Only Utilities</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-800 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>200 AI Requests / day (20x)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-800 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>1,000 File Conversions / day (20x)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-800 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Priority Server Processing Queue</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan('PREMIUM')}
                disabled={checkoutLoading === 'PREMIUM'}
                className="mt-8 w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                {checkoutLoading === 'PREMIUM' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Initiating Checkout...</span>
                  </>
                ) : (
                  <>
                    <span>Upgrade to Premium</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security & Privacy Guarantee Card */}
        <div className="mt-16 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 text-center max-w-3xl mx-auto shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-3 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 mb-2">
            Privacy & Payment Security Guarantee
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xl mx-auto">
            All checkouts utilize provider-hosted tokenization and encrypted SSL sessions. We never store, process,
            or access raw credit card numbers or CVV codes. Subscriptions can be canceled at any time with
            one click.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
              <span>FREQUENTLY ASKED QUESTIONS</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Got Questions? We&apos;ve Got Answers</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                <h4 className="text-sm font-bold text-slate-900">{faq.q}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFBFD] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
