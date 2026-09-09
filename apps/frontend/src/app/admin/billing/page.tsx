'use client';

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../../context/admin-auth-context';
import {
  AdminBillingOverviewDto,
  PlanDto,
  SubscriptionDto,
  BillingEventDto,
} from '@ad-utility/shared';

export default function AdminBillingPage() {
  const { hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'subscriptions' | 'entitlements' | 'events'>(
    'overview',
  );

  const [overview, setOverview] = useState<AdminBillingOverviewDto | null>(null);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionDto[]>([]);
  const [events, setEvents] = useState<BillingEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('accessToken') : null;

  const fetchOverview = async () => {
    try {
      const res = await fetch('http://localhost:4001/api/v1/admin/billing/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setOverview(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch billing overview:', err);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch('http://localhost:4001/api/v1/admin/billing/plans', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setPlans(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const url = statusFilter
        ? `http://localhost:4001/api/v1/admin/billing/subscriptions?status=${statusFilter}`
        : 'http://localhost:4001/api/v1/admin/billing/subscriptions';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) setSubscriptions(json.data.items);
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch('http://localhost:4001/api/v1/admin/billing/events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) setEvents(json.data.items);
      }
    } catch (err) {
      console.error('Failed to fetch billing events:', err);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchPlans(), fetchSubscriptions(), fetchEvents()]);
      setLoading(false);
    }
    loadData();
  }, [statusFilter]);

  if (!hasPermission('billing:read')) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>You do not have permission to view billing data (requires <code className="text-indigo-400">billing:read</code>).</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Billing & Monetization Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative subscription lifecycle, plan management, entitlements, and revenue truth verification.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          {(['overview', 'plans', 'subscriptions', 'entitlements', 'events'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-8">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-xs text-slate-400 font-medium block mb-1">Total Subscribers</span>
                  <span className="text-3xl font-extrabold text-white">{overview.totalSubscribers}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Authoritative DB records</span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-xs text-emerald-400 font-medium block mb-1">Active Subscriptions</span>
                  <span className="text-3xl font-extrabold text-emerald-400">{overview.activeSubscriptions}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Current active entitlements</span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-xs text-slate-400 font-medium block mb-1">Canceled Subscriptions</span>
                  <span className="text-3xl font-extrabold text-slate-300">{overview.canceledSubscriptions}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Churned or ended</span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-xs text-amber-400 font-medium block mb-1">Past Due Subscriptions</span>
                  <span className="text-3xl font-extrabold text-amber-400">{overview.pastDueSubscriptions}</span>
                  <span className="text-[11px] text-slate-500 block mt-1">Payment renewal failed</span>
                </div>
              </div>

              {/* Revenue Truth & Provider Health Row */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Revenue Truth Card (Recommendation #8) */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>⚖️</span>
                      <span>Revenue Truth & Accounting</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {overview.revenueTruth.label}
                    </span>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Actual Revenue Total:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {overview.revenueTruth.actualRevenueTotal === null
                          ? 'null (No Authoritative Provider Data)'
                          : `$${overview.revenueTruth.actualRevenueTotal}`}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Revenue Available:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {overview.revenueTruth.revenueAvailable ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 leading-relaxed text-[11px]">
                      <strong className="text-slate-300">Revenue Policy:</strong> {overview.revenueTruth.reason}
                    </div>
                  </div>
                </div>

                {/* Payment Provider Health Card (Recommendation #9) */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>🔌</span>
                      <span>Payment Provider Status</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {overview.providerHealth.provider}
                    </span>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Configuration:</span>
                      <span className="font-semibold text-slate-200">
                        {overview.providerHealth.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Environment:</span>
                      <span className="font-semibold text-slate-200">
                        {overview.providerHealth.environment}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Real Verification Status:</span>
                      <span className="font-mono text-slate-300">
                        {overview.providerHealth.realVerificationStatus}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Provider Health:</span>
                      <span className="font-bold text-emerald-400">
                        {overview.providerHealth.health}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLANS */}
          {activeTab === 'plans' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">Configured Subscription Plans</h3>
                <span className="text-xs text-slate-400">{plans.length} plans</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Code</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Interval</th>
                      <th className="p-3">Show Ads</th>
                      <th className="p-3">AI Limit/Day</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {plans.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-indigo-400">{p.code}</td>
                        <td className="p-3 font-medium text-white">{p.name}</td>
                        <td className="p-3 font-mono">${(p.priceCents / 100).toFixed(2)}</td>
                        <td className="p-3">{p.billingInterval || '—'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${p.entitlements.showAds ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {p.entitlements.showAds ? 'Ads Enabled' : 'Ad-Free'}
                          </span>
                        </td>
                        <td className="p-3 font-mono">{p.usageLimits.dailyAiRequests}</td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-semibold">Active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SUBSCRIPTIONS */}
          {activeTab === 'subscriptions' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <h3 className="font-bold text-white text-sm">Customer Subscriptions</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Filter status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200"
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAST_DUE">Past Due</option>
                    <option value="CANCELED">Canceled</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">User Email</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Provider Sub ID</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Period End</th>
                      <th className="p-3">Auto-Renew</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {subscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No subscriptions matching the filter.
                        </td>
                      </tr>
                    ) : (
                      subscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-800/30">
                          <td className="p-3 font-medium text-white">{sub.userEmail || sub.userId}</td>
                          <td className="p-3 font-semibold text-indigo-300">{sub.planCode}</td>
                          <td className="p-3 uppercase text-slate-400">{sub.provider}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">
                            {sub.providerSubscriptionId || '—'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                sub.status === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : sub.status === 'PAST_DUE'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="p-3">
                            {sub.currentPeriodEnd
                              ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="p-3">
                            {sub.cancelAtPeriodEnd ? (
                              <span className="text-amber-400 font-semibold">Ends at cycle</span>
                            ) : (
                              <span className="text-emerald-400">Yes</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ENTITLEMENTS */}
          {activeTab === 'entitlements' && (
            <div className="grid md:grid-cols-2 gap-6">
              {plans.map((p) => (
                <div key={p.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <h3 className="text-lg font-bold text-white">{p.name} Entitlements</h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-indigo-400">
                      {p.code}
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1 font-semibold">Advertising Policy:</span>
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                        <span>Show Advertisements</span>
                        <span className={`font-bold ${p.entitlements.showAds ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {p.entitlements.showAds ? 'YES' : 'NO (Ad-Free)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1 font-semibold">Usage Limits:</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-500 block mb-1">Daily AI Requests</span>
                          <span className="text-lg font-mono font-bold text-white">
                            {p.usageLimits.dailyAiRequests}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-500 block mb-1">Daily Conversions</span>
                          <span className="text-lg font-mono font-bold text-white">
                            {p.usageLimits.dailyConversions}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1 font-semibold">Feature Flags:</span>
                      <div className="flex flex-wrap gap-2">
                        {p.entitlements.features.map((f) => (
                          <span key={f} className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: EVENTS */}
          {activeTab === 'events' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">Authoritative Billing Webhook Events Audit</h3>
                <span className="text-xs text-slate-400">{events.length} recorded events</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Provider Event ID</th>
                      <th className="p-3">Event Type</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Processed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          No webhook events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      events.map((evt) => (
                        <tr key={evt.id} className="hover:bg-slate-800/30 font-mono text-[11px]">
                          <td className="p-3 text-indigo-300 font-bold">{evt.providerEventId}</td>
                          <td className="p-3 text-white">{evt.eventType}</td>
                          <td className="p-3 uppercase text-slate-400">{evt.provider}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              {evt.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">
                            {new Date(evt.processedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
