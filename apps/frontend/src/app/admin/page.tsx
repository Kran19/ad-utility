'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApiFetch } from '../../lib/admin-api';
import { AdminDashboardMetricsDto } from '@ad-utility/shared';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      const res = await adminApiFetch<AdminDashboardMetricsDto>('/admin/dashboard');
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        setError(res.error || 'Failed to load dashboard metrics');
      }
      setLoading(false);
    }
    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
        {error}
      </div>
    );
  }

  const cards = [
    { label: 'Active Campaigns', value: metrics?.activeCampaigns ?? 0, total: metrics?.totalCampaigns, icon: '🎯', href: '/admin/campaigns', color: 'from-blue-500/20 to-indigo-500/10' },
    { label: 'Active Utilities', value: metrics?.activeUtilities ?? 0, total: metrics?.totalUtilities, icon: '⚡', href: '/admin/utilities', color: 'from-amber-500/20 to-orange-500/10' },
    { label: 'Total Creatives', value: metrics?.totalCreatives ?? 0, icon: '🖼️', href: '/admin/creatives', color: 'from-purple-500/20 to-pink-500/10' },
    { label: 'Admin Users', value: metrics?.totalUsers ?? 0, icon: '👥', href: '/admin/users', color: 'from-emerald-500/20 to-teal-500/10' },
    { label: 'Ad Impressions', value: (metrics?.totalImpressions ?? 0).toLocaleString(), icon: '👁️', href: '/admin/analytics', color: 'from-cyan-500/20 to-blue-500/10' },
    { label: 'Ad CTR', value: `${metrics?.adCtr ?? 0}%`, icon: '🖱️', href: '/admin/analytics', color: 'from-pink-500/20 to-rose-500/10' },
    { label: 'Tool Completion Rate', value: `${metrics?.toolCompletionRate ?? 0}%`, icon: '✅', href: '/admin/analytics', color: 'from-emerald-500/20 to-green-500/10' },
    { label: 'AI Cost (USD)', value: `$${metrics?.totalAiCostUsd ?? 0}`, icon: '🤖', href: '/admin/ai-usage', color: 'from-indigo-500/20 to-violet-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Overview</h1>
        <p className="text-xs text-slate-400 mt-1">Real-time status, performance indicators, and administrative control</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`p-5 rounded-2xl bg-gradient-to-br ${c.color} bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all shadow-lg hover:shadow-xl group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">Manage &rarr;</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-white tracking-tight">{c.value}</div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center justify-between">
                <span>{c.label}</span>
                {c.total !== undefined && <span className="text-slate-500 text-[11px]">of {c.total} total</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Launch & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>⚡</span> Quick Management Shortcuts
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/campaigns"
              className="p-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              + Create Campaign
            </Link>
            <Link
              href="/admin/creatives"
              className="p-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              + Upload Creative
            </Link>
            <Link
              href="/admin/utilities"
              className="p-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              ⚡ Manage Utilities
            </Link>
            <Link
              href="/admin/audit-logs"
              className="p-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              📜 View Audit Trail
            </Link>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>🛡️</span> Security & Policy Architecture
          </h2>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span>Authentication</span>
              <span className="text-emerald-400 font-mono">JWT / Dual-Token RBAC</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span>Audit Logging</span>
              <span className="text-emerald-400 font-mono">Transactional Logging</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span>Creative Payload Policy</span>
              <span className="text-emerald-400 font-mono">Safe URL / Sanitized HTML</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
