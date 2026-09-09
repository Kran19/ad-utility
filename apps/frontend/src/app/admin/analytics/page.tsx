'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

type TabKey = 'personalization' | 'bi' | 'journey' | 'seo' | 'funnel' | 'acquisition' | 'utilities' | 'monetization' | 'experiments' | 'telemetry';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [monetizationData, setMonetizationData] = useState<any>(null);
  const [biData, setBiData] = useState<any>(null);
  const [journeyData, setJourneyData] = useState<any>(null);
  const [seoData, setSeoData] = useState<any>(null);
  const [personalizationData, setPersonalizationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [activeTab, setActiveTab] = useState<TabKey>('personalization');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSyncRevenue = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await adminApiFetch('/admin/ads/provider/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.success && res.data) {
        setSyncMessage(`Sync complete: ${res.data.recordsIngested} ingested, ${res.data.duplicatesSkipped} skipped ($${res.data.totalRevenue})`);
        const updated = await adminApiFetch(`/admin/analytics/monetization?days=${days}`);
        if (updated.success && updated.data) {
          setMonetizationData(updated.data);
        }
      } else {
        setSyncMessage(res.error || 'Failed to synchronize revenue');
      }
    } catch {
      setSyncMessage('Error triggering sync');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [growthRes, overviewRes, monetizationRes, biRes, journeyRes, seoRes, persRes] = await Promise.all([
        adminApiFetch(`/admin/analytics/growth?days=${days}`),
        adminApiFetch(`/admin/analytics/overview?days=${days}`),
        adminApiFetch(`/admin/analytics/monetization?days=${days}`),
        adminApiFetch(`/admin/analytics/business-intelligence?days=${days}`),
        adminApiFetch(`/admin/analytics/journey?days=${days}`),
        adminApiFetch(`/admin/analytics/seo?days=${days}`),
        adminApiFetch(`/admin/analytics/personalization?days=${days}`),
      ]);

      if (growthRes.success && growthRes.data) {
        setData(growthRes.data);
      }
      if (overviewRes.success && overviewRes.data) {
        setOverviewData(overviewRes.data);
      }
      if (monetizationRes.success && monetizationRes.data) {
        setMonetizationData(monetizationRes.data);
      }
      if (biRes.success && biRes.data) {
        setBiData(biRes.data);
      }
      if (journeyRes.success && journeyRes.data) {
        setJourneyData(journeyRes.data);
      }
      if (seoRes.success && seoRes.data) {
        setSeoData(seoRes.data);
      }
      if (persRes.success && persRes.data) {
        setPersonalizationData(persRes.data);
      }
      setLoading(false);
    }
    load();
  }, [days]);

  const funnel = data?.funnel;
  const acquisition = data?.acquisition;
  const utilities = data?.utilities || [];
  const monetization = monetizationData || data?.monetization;
  const experiments = data?.experiments || [];
  const recentEvents = overviewData?.recentEvents || [];
  const recommendations = monetization?.recommendations || [];
  const bi = biData;
  const health = bi?.health;
  const opportunities = bi?.opportunities || [];
  const journey = journeyData;
  const journeyQuality = journey?.journeyQuality;
  const retentionHealth = journey?.retentionHealth;
  const returningVisitors = journey?.returningVisitors;
  const retentionCohorts = journey?.retentionCohorts || [];
  const sessionDepth = journey?.sessionDepth || [];
  const crossUtilityFlows = journey?.crossUtilityFlows || [];
  const acquisitionRetention = journey?.acquisitionRetention || [];
  const deviceRetention = journey?.deviceRetention || [];
  const experimentImpacts = journey?.experimentImpacts || [];
  const journeyOpportunities = journey?.opportunities || [];
  const seo = seoData;
  const seoHealth = seo?.health;
  const seoOrganicOverview = seo?.overview;
  const seoOpportunities = seo?.opportunities || [];
  const seoUtilityPerformance = seo?.utilityPerformance || [];
  const seoCategoryPerformance = seo?.categoryPerformance || [];
  const seoInternalLinks = seo?.internalLinks || [];
  const seoContentCoverage = seo?.contentCoverage || [];
  const seoSitemap = seo?.sitemap;

  const pers = personalizationData;
  const persReadiness = pers?.readinessScore ?? 80;
  const persOverview = pers?.conversionOverview;
  const persOpps = pers?.opportunities || [];
  const persCta = pers?.ctaPerformance || [];
  const persRelated = pers?.relatedUtilityPerformance || [];
  const persDevice = pers?.devicePerformance || [];
  const persAcquisition = pers?.acquisitionPerformance || [];
  const persRules = pers?.activeRules || [];
  const persExpCount = pers?.experimentPrecedenceCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Business & Journey Intelligence</h1>
          <p className="text-xs text-slate-400 mt-1">
            Executive business health, retention cohorts, session depth, cross-utility flows & advisory optimization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 self-start sm:self-auto"
          >
            <option value="1">Today (24h)</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('personalization')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'personalization'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Personalization & Conversion
        </button>
        <button
          onClick={() => setActiveTab('bi')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'bi'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Executive BI & Health
        </button>
        <button
          onClick={() => setActiveTab('journey')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'journey'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Journey & Retention
        </button>
        <button
          onClick={() => setActiveTab('seo')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'seo'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          SEO & Organic Growth
        </button>
        <button
          onClick={() => setActiveTab('funnel')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'funnel'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Funnel & Conversion
        </button>
        <button
          onClick={() => setActiveTab('acquisition')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'acquisition'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Acquisition & Attribution
        </button>
        <button
          onClick={() => setActiveTab('utilities')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'utilities'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Utility Intelligence
        </button>
        <button
          onClick={() => setActiveTab('monetization')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'monetization'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Ad Yield & Monetization
        </button>
        <button
          onClick={() => setActiveTab('experiments')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'experiments'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          A/B Experimentation
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'telemetry'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Live Telemetry Stream
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Aggregating Business Intelligence, Personalization & Journey telemetry...
        </div>
      ) : (
        <div className="space-y-8">
          {/* TAB: PRIVACY-SAFE PERSONALIZATION & CONVERSION OPTIMIZATION */}
          {activeTab === 'personalization' && (
            <div className="space-y-6">
              {/* Executive Overview Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Personalization Readiness Score Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">Personalization Readiness</h2>
                      <p className="text-[11px] text-slate-400">Deterministic context & rule activation index</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        persReadiness >= 80
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : persReadiness >= 60
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {persReadiness >= 80 ? 'HIGH READINESS' : persReadiness >= 60 ? 'OPTIMIZING' : 'INITIALIZING'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-white">{persReadiness}</span>
                    <span className="text-xs text-slate-400 font-mono">/ 100 Index</span>
                  </div>

                  <div className="space-y-2 pt-2 text-xs border-t border-slate-800/80">
                    <div className="flex justify-between text-slate-400">
                      <span>Active Deterministic Rules:</span>
                      <strong className="text-white font-mono">{persRules.length} rules</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Experiment Precedence Exposures:</span>
                      <strong className="text-cyan-400 font-mono">{persExpCount} exposures</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Privacy Paradigm:</span>
                      <span className="text-emerald-400 font-semibold">Zero User Profiling</span>
                    </div>
                  </div>
                </div>

                {/* Conversion Funnel Overview Card */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4 flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide uppercase">Observed Conversion Funnel</h2>
                    <p className="text-xs text-slate-400">Aggregated first-party progression across tools</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">1. Page Views</span>
                      <div className="text-xl font-black text-white">{persOverview?.totalViews?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-500">Landing impressions</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-blue-400 uppercase">2. Tool Starts</span>
                      <div className="text-xl font-black text-blue-400">{persOverview?.totalStarts?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{((persOverview?.overallStartRate ?? 0) * 100).toFixed(1)}% start rate</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">3. Completions</span>
                      <div className="text-xl font-black text-emerald-400">{persOverview?.totalCompletions?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{((persOverview?.overallCompletionRate ?? 0) * 100).toFixed(1)}% comp rate</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-purple-400 uppercase">4. Downloads</span>
                      <div className="text-xl font-black text-purple-400">{persOverview?.totalDownloads?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{((persOverview?.overallDownloadRate ?? 0) * 100).toFixed(1)}% dl rate</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>Funnel Throughput: <strong className="text-white">{((persOverview?.totalViews ?? 0) > 0 ? (((persOverview?.totalDownloads ?? 0) / (persOverview?.totalViews ?? 1)) * 100).toFixed(2) : '0.00')}%</strong> end-to-end</span>
                    <span className="text-[11px] text-slate-500 font-mono">Fail-Open Cached (60s TTL)</span>
                  </div>
                </div>
              </div>

              {/* Diagnostic Conversion Opportunities Queue */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase">Conversion Opportunity Queue</h3>
                    <p className="text-xs text-slate-400">Deterministic friction diagnosis & actionable personalization recommendations</p>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {persOpps.length} Prioritized Opportunities
                  </span>
                </div>

                {persOpps.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800">
                    No conversion friction detected. Platform funnels are operating within healthy parameters.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {persOpps.map((opp: any) => (
                      <div
                        key={opp.id}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                opp.priority === 'HIGH'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {opp.priority} PRIORITY
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                              {opp.type.replace(/_/g, ' ')}
                            </span>
                            <h4 className="text-sm font-bold text-white">{opp.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Opportunity Score:</span>
                            <strong className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded">{opp.score}/100</strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-900/60 p-3 rounded border border-slate-800/40">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">WHAT:</span>
                            <p className="text-slate-300 mt-0.5">{opp.what}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">WHY:</span>
                            <p className="text-slate-300 mt-0.5">{opp.why}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">ACTION:</span>
                            <p className="text-emerald-300 font-medium mt-0.5">{opp.action}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 pt-1">
                          <span>Views: <strong className="text-white">{opp.supportingMetrics?.views}</strong></span>
                          <span>Starts: <strong className="text-blue-400">{opp.supportingMetrics?.starts}</strong> ({((opp.supportingMetrics?.startRate ?? 0) * 100).toFixed(1)}%)</span>
                          <span>Completions: <strong className="text-emerald-400">{opp.supportingMetrics?.completions}</strong> ({((opp.supportingMetrics?.completionRate ?? 0) * 100).toFixed(1)}%)</span>
                          <span>Downloads: <strong className="text-purple-400">{opp.supportingMetrics?.downloads}</strong> ({((opp.supportingMetrics?.downloadRate ?? 0) * 100).toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Surface Performance & Related Utilities Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CTA Surface Performance */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CTA Surface Performance</h3>
                    <p className="text-[11px] text-slate-500">Observed impressions and conversion throughput by surface</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Surface</th>
                          <th className="px-3 py-2">Variant</th>
                          <th className="px-3 py-2">Impressions</th>
                          <th className="px-3 py-2">Conversions</th>
                          <th className="px-3 py-2">CTR / Conv %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {persCta.map((c: any) => (
                          <tr key={c.surface} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-bold text-white">{c.surface}</td>
                            <td className="px-3 py-2 text-indigo-400">{c.variantId}</td>
                            <td className="px-3 py-2 text-slate-200">{c.impressions?.toLocaleString() ?? 0}</td>
                            <td className="px-3 py-2 text-emerald-400">{c.conversions?.toLocaleString() ?? 0}</td>
                            <td className="px-3 py-2 font-bold text-cyan-400">{((c.ctr ?? 0) * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Related Utility Cross-Conversion */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Related Utility Progression Matrix</h3>
                    <p className="text-[11px] text-slate-500">Reciprocal tool transitions and downstream completions</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Source &rarr; Target</th>
                          <th className="px-3 py-2">Clicks</th>
                          <th className="px-3 py-2">Completions</th>
                          <th className="px-3 py-2">Transition Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {persRelated.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 text-slate-200">
                              <span className="font-semibold text-indigo-300">{r.sourceSlug}</span>
                              <span className="text-slate-500 mx-1.5">&rarr;</span>
                              <span className="font-semibold text-emerald-300">{r.targetSlug}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-200">{r.clicks}</td>
                            <td className="px-3 py-2 text-emerald-400">{r.conversions}</td>
                            <td className="px-3 py-2 font-bold text-cyan-400">{((r.conversionRate ?? 0) * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Device & Acquisition Conversion Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Device Performance Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Device Conversion Performance</h3>
                    <p className="text-[11px] text-slate-500">Observed funnel throughput by coarse device class</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Device</th>
                          <th className="px-3 py-2">Views</th>
                          <th className="px-3 py-2">Starts</th>
                          <th className="px-3 py-2">Start Rate</th>
                          <th className="px-3 py-2">Completion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {persDevice.map((d: any) => (
                          <tr key={d.deviceType} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-bold text-white capitalize">{d.deviceType}</td>
                            <td className="px-3 py-2 text-slate-200">{d.views}</td>
                            <td className="px-3 py-2 text-blue-400">{d.starts}</td>
                            <td className="px-3 py-2 text-cyan-400">{((d.startRate ?? 0) * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 font-bold text-emerald-400">{((d.completionRate ?? 0) * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Acquisition Channel Breakdown */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acquisition Channel Conversion</h3>
                    <p className="text-[11px] text-slate-500">First-party attribution channel conversion rates</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Channel</th>
                          <th className="px-3 py-2">Views</th>
                          <th className="px-3 py-2">Starts</th>
                          <th className="px-3 py-2">Start Rate</th>
                          <th className="px-3 py-2">Completion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {persAcquisition.map((a: any) => (
                          <tr key={a.channel} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-bold text-white capitalize">{a.channel}</td>
                            <td className="px-3 py-2 text-slate-200">{a.views}</td>
                            <td className="px-3 py-2 text-blue-400">{a.starts}</td>
                            <td className="px-3 py-2 text-cyan-400">{((a.startRate ?? 0) * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 font-bold text-emerald-400">{((a.completionRate ?? 0) * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Active Rules Configuration */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Personalization Rules</h3>
                    <p className="text-[11px] text-slate-500">Deterministic, priority-ordered rules (evaluated top-to-bottom)</p>
                  </div>
                  <span className="text-xs text-indigo-400 font-mono font-semibold">
                    Experiment Precedence Active
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Priority</th>
                        <th className="px-3 py-2">Rule Name</th>
                        <th className="px-3 py-2">Surface</th>
                        <th className="px-3 py-2">Conditions</th>
                        <th className="px-3 py-2">Target Variant</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {persRules.map((rule: any) => (
                        <tr key={rule.id} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-black text-indigo-400">P{rule.priority}</td>
                          <td className="px-3 py-2 font-bold text-white">{rule.name}</td>
                          <td className="px-3 py-2 text-cyan-300">{rule.surface}</td>
                          <td className="px-3 py-2 text-slate-400 text-[10px] max-w-[200px] truncate" title={JSON.stringify(rule.conditions)}>
                            {JSON.stringify(rule.conditions)}
                          </td>
                          <td className="px-3 py-2 text-emerald-400">{rule.targetVariantId}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                              ACTIVE
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 0: EXECUTIVE BUSINESS INTELLIGENCE & HEALTH */}
          {activeTab === 'bi' && (
            <div className="space-y-6">
              {/* Health Score & Key KPIs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Platform Health Score Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">Business Health Score</h2>
                      <p className="text-[11px] text-slate-400">Observed composite growth indicator</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        health?.status === 'EXCELLENT'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : health?.status === 'HEALTHY'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {health?.status || 'HEALTHY'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-white">{health?.overallScore ?? 75}</span>
                    <span className="text-xs text-slate-400 font-mono">/ 100 Index</span>
                  </div>

                  <div className="space-y-2.5 pt-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Acquisition Quality</span>
                        <span className="font-mono text-white">{health?.components?.acquisitionQuality ?? 70}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${health?.components?.acquisitionQuality ?? 70}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Funnel Conversion</span>
                        <span className="font-mono text-white">{health?.components?.funnelHealth ?? 65}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${health?.components?.funnelHealth ?? 65}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Monetization Efficiency</span>
                        <span className="font-mono text-white">{health?.components?.monetizationEfficiency ?? 70}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${health?.components?.monetizationEfficiency ?? 70}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business KPIs Summary */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">Business Value Metrics</h2>
                      <p className="text-[11px] text-slate-400">Observed platform engagement & conversion value</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                      Composite Value: {bi?.kpis?.businessValueProxy ?? 0}/100
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Page Views</span>
                      <div className="text-xl font-black text-white">{bi?.kpis?.totalPageViews?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-500">Total Visits</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Completions</span>
                      <div className="text-xl font-black text-emerald-400">{bi?.kpis?.totalToolCompletions?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{bi?.kpis?.funnelCompletionRate ?? 0}% conversion</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase">Ad Clicks</span>
                      <div className="text-xl font-black text-cyan-400">{bi?.kpis?.totalAdClicks?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{bi?.kpis?.overallCtr ?? 0}% CTR</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-purple-400 uppercase">Downloads</span>
                      <div className="text-xl font-black text-purple-400">{bi?.kpis?.totalResultDownloads?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{bi?.kpis?.downloadRate ?? 0}% export rate</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3 text-xs text-slate-400 flex items-center justify-between">
                    <span>Active Inventory: <strong className="text-white">{bi?.kpis?.activeUtilitiesCount ?? 18} Utilities</strong>, <strong className="text-white">{bi?.kpis?.activeCampaignsCount ?? 0} Campaigns</strong></span>
                    <span className="text-[11px] text-indigo-400 font-semibold">{bi?.kpis?.activeExperimentsCount ?? 3} Active A/B Experiments</span>
                  </div>
                </div>
              </div>

              {/* Optimization Opportunities Feed */}
              {opportunities.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Prioritized Optimization Opportunities
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Advisory business recommendations across acquisition, utilities, ads & experiments</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{opportunities.length} opportunities identified</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {opportunities.map((opp: any) => (
                      <div
                        key={opp.id}
                        className={`border rounded-lg p-4 space-y-2.5 transition-all ${
                          opp.severity === 'CRITICAL'
                            ? 'bg-rose-950/20 border-rose-800/60'
                            : opp.severity === 'WARNING'
                            ? 'bg-amber-950/20 border-amber-800/60'
                            : 'bg-slate-950/40 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                              opp.severity === 'CRITICAL'
                                ? 'bg-rose-900/60 text-rose-300'
                                : opp.severity === 'WARNING'
                                ? 'bg-amber-900/60 text-amber-300'
                                : 'bg-indigo-900/60 text-indigo-300'
                            }`}
                          >
                            {opp.severity} • {opp.area}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Confidence: {opp.confidenceLevel}</span>
                        </div>
                        <div className="font-bold text-white text-xs">{opp.entity}</div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">{opp.reason}</p>
                        <div className="text-[11px] bg-slate-900/90 p-2.5 rounded border border-slate-800 text-slate-300">
                          <span className="text-indigo-400 font-bold">Action: </span>{opp.recommendedAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acquisition Quality & Attribution Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acquisition Attribution & Traffic Quality</h3>
                    <p className="text-[11px] text-slate-500">First-touch UTM conversion attribution and 0–100 quality scores</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Channel / Source</th>
                        <th className="px-4 py-2.5">Visits</th>
                        <th className="px-4 py-2.5">Starts</th>
                        <th className="px-4 py-2.5">Completions</th>
                        <th className="px-4 py-2.5">Downloads</th>
                        <th className="px-4 py-2.5">Ad Clicks</th>
                        <th className="px-4 py-2.5">Completion Rate</th>
                        <th className="px-4 py-2.5">Quality Score</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {bi?.acquisitionAttribution?.length > 0 ? (
                        bi.acquisitionAttribution.map((a: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2 font-bold text-white">{a.source}</td>
                            <td className="px-4 py-2 text-slate-200">{a.visits.toLocaleString()}</td>
                            <td className="px-4 py-2 text-blue-400">{a.toolStarts.toLocaleString()}</td>
                            <td className="px-4 py-2 text-emerald-400">{a.toolCompletions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-purple-400">{a.resultDownloads.toLocaleString()}</td>
                            <td className="px-4 py-2 text-cyan-400">{a.adClicks.toLocaleString()}</td>
                            <td className="px-4 py-2 font-bold text-emerald-400">{a.completionRate}%</td>
                            <td className="px-4 py-2">
                              <span className="font-bold text-white">{a.acquisitionQualityScore}/100</span>
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  a.status === 'HIGH_QUALITY'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                    : a.status === 'LOW_QUALITY'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                                    : a.status === 'INSUFFICIENT_DATA'
                                    ? 'bg-slate-800 text-slate-400'
                                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-4 py-4 text-center text-slate-500 italic">No attribution traffic recorded in this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Utility Business Opportunity Matrix */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utility Business Value & Growth Opportunity</h3>
                    <p className="text-[11px] text-slate-500">Ranked by composite opportunity score (Traffic + Completion + Ad Yield)</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Rank</th>
                        <th className="px-4 py-2.5">Utility Name</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Traffic</th>
                        <th className="px-4 py-2.5">Completion Rate</th>
                        <th className="px-4 py-2.5">Export Rate</th>
                        <th className="px-4 py-2.5">Ad CTR</th>
                        <th className="px-4 py-2.5">Opportunity Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {bi?.utilityBusinessValues?.length > 0 ? (
                        bi.utilityBusinessValues.map((u: any) => (
                          <tr key={u.utilitySlug} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2 font-bold text-indigo-400">#{u.priorityRank}</td>
                            <td className="px-4 py-2 font-bold text-white">{u.name}</td>
                            <td className="px-4 py-2 text-slate-400">{u.categorySlug}</td>
                            <td className="px-4 py-2 text-slate-200">{u.trafficVolume.toLocaleString()}</td>
                            <td className="px-4 py-2 font-bold text-emerald-400">{u.completionRate}%</td>
                            <td className="px-4 py-2 text-purple-400">{u.downloadRate}%</td>
                            <td className="px-4 py-2 text-cyan-400">{u.adCtr}%</td>
                            <td className="px-4 py-2">
                              <span className="font-bold text-white">{u.opportunityScore}/100</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 text-center text-slate-500 italic">No utility business data available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: JOURNEY & RETENTION INTELLIGENCE */}
          {activeTab === 'journey' && (
            <div className="space-y-6">
              {/* Executive Journey & Retention Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Journey Quality Score Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">Journey Quality Score</h2>
                      <p className="text-[11px] text-slate-400">Deterministic workflow health indicator</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        journeyQuality?.rating === 'EXCELLENT'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : journeyQuality?.rating === 'GOOD'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : journeyQuality?.rating === 'FAIR'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {journeyQuality?.rating || 'INSUFFICIENT_DATA'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-white">{journeyQuality?.score ?? 0}</span>
                    <span className="text-xs text-slate-400 font-mono">/ 100 Index</span>
                  </div>

                  <div className="space-y-2.5 pt-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Task Completion (35% wt)</span>
                        <span className="font-mono text-white">{journeyQuality?.components?.completionScore ?? 0} pts</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, ((journeyQuality?.components?.completionScore ?? 0) / 35) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Result Export (25% wt)</span>
                        <span className="font-mono text-white">{journeyQuality?.components?.downloadScore ?? 0} pts</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(100, ((journeyQuality?.components?.downloadScore ?? 0) / 25) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Multi-Tool Depth (20% wt)</span>
                        <span className="font-mono text-white">{journeyQuality?.components?.multiUtilityScore ?? 0} pts</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, ((journeyQuality?.components?.multiUtilityScore ?? 0) / 20) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Return Rate (15% wt)</span>
                        <span className="font-mono text-white">{journeyQuality?.components?.returnScore ?? 0} pts</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${Math.min(100, ((journeyQuality?.components?.returnScore ?? 0) / 15) * 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-800/80">
                    {journeyQuality?.explanation || 'Aggregated observed journey indicators.'}
                  </p>
                </div>

                {/* Retention Health Index & Anonymous Session Metrics */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-5 flex flex-col justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-white tracking-wide uppercase">Anonymous Retention Health Index</h2>
                      <p className="text-xs text-slate-400">Observed returning session patterns & multi-session depth</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${
                        retentionHealth?.status === 'HEALTHY'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : retentionHealth?.status === 'MODERATE'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {retentionHealth?.status || 'INSUFFICIENT_DATA'} ({retentionHealth?.score ?? 0}/100)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">First Visits</span>
                      <div className="text-xl font-black text-white">{returningVisitors?.firstSessionVolume?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-500">Initial sessions</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase">Returning</span>
                      <div className="text-xl font-black text-cyan-400">{returningVisitors?.returningSessionVolume?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{returningVisitors?.returnRate ?? 0}% return rate</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Multi-Tool Rate</span>
                      <div className="text-xl font-black text-indigo-400">{returningVisitors?.multiUtilityRate ?? 0}%</div>
                      <span className="text-[10px] text-slate-400">&ge; 2 tools used</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-purple-400 uppercase">Avg Tools/Session</span>
                      <div className="text-xl font-black text-purple-400">{returningVisitors?.avgUtilitiesPerSession ?? 1.0}</div>
                      <span className="text-[10px] text-slate-400">Exploration depth</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>Summary Cohorts: <strong className="text-white">D1: {journey?.retentionSummary?.overallD1RetentionRate ?? 0}%</strong> • <strong className="text-white">D7: {journey?.retentionSummary?.overallD7RetentionRate ?? 0}%</strong> • <strong className="text-white">D30: {journey?.retentionSummary?.overallD30RetentionRate ?? 0}%</strong></span>
                    <span className="text-[11px] text-slate-500 font-mono">Anonymous Token Aggregations Only</span>
                  </div>
                </div>
              </div>

              {/* Journey Opportunities Feed */}
              {journeyOpportunities.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        Prioritized Journey & Retention Opportunities
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Advisory recommendations for utility discoverability, retention & cross-tool pathways</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{journeyOpportunities.length} opportunities</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {journeyOpportunities.map((opp: any) => (
                      <div
                        key={opp.id}
                        className={`border rounded-lg p-4 space-y-2.5 transition-all ${
                          opp.severity === 'HIGH'
                            ? 'bg-rose-950/20 border-rose-800/60'
                            : opp.severity === 'MEDIUM'
                            ? 'bg-amber-950/20 border-amber-800/60'
                            : 'bg-slate-950/40 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                              opp.severity === 'HIGH'
                                ? 'bg-rose-900/60 text-rose-300'
                                : opp.severity === 'MEDIUM'
                                ? 'bg-amber-900/60 text-amber-300'
                                : 'bg-indigo-900/60 text-indigo-300'
                            }`}
                          >
                            {opp.severity} • {opp.area}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Confidence: {opp.confidenceLevel}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{opp.entity}</h4>
                          <p className="text-[11px] text-slate-300 mt-0.5">{opp.reason}</p>
                        </div>
                        <div className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
                          <span className="text-slate-400">{opp.metric}:</span>
                          <span className="font-mono font-bold text-white">{opp.currentValue}</span>
                        </div>
                        <div className="text-[11px] text-slate-300 bg-indigo-950/30 border border-indigo-900/40 p-2 rounded">
                          <strong className="text-indigo-400 font-semibold">Recommended Action: </strong>
                          {opp.recommendedAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retention Cohorts Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anonymous Retention Cohorts</h3>
                    <p className="text-[11px] text-slate-500">Track returning session rate across D1, D7, D14, and D30 intervals</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Cohort Date</th>
                        <th className="px-4 py-2.5">Cohort Size</th>
                        <th className="px-4 py-2.5">Day 1 Retention</th>
                        <th className="px-4 py-2.5">Day 7 Retention</th>
                        <th className="px-4 py-2.5">Day 14 Retention</th>
                        <th className="px-4 py-2.5">Day 30 Retention</th>
                        <th className="px-4 py-2.5">Maturity Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {retentionCohorts.length > 0 ? (
                        retentionCohorts.map((c: any) => (
                          <tr key={c.cohortDate} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2 font-bold text-white">{c.cohortDate}</td>
                            <td className="px-4 py-2 text-slate-200">{c.cohortSize.toLocaleString()}</td>
                            <td className="px-4 py-2 text-cyan-400">{c.d1RetentionRate}% ({c.d1Returning})</td>
                            <td className="px-4 py-2 text-indigo-400">{c.d7RetentionRate}% ({c.d7Returning})</td>
                            <td className="px-4 py-2 text-purple-400">{c.d14RetentionRate}% ({c.d14Returning})</td>
                            <td className="px-4 py-2 text-emerald-400">{c.d30RetentionRate}% ({c.d30Returning})</td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  c.status === 'MATURE'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-center text-slate-500 italic">No retention cohorts recorded in this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Session Depth & Cross-Utility Flow Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Session Depth Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Depth Distribution</h3>
                    <p className="text-[11px] text-slate-500">Task completion and ad engagement grouped by tools used per session</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Depth</th>
                          <th className="px-3 py-2">Sessions</th>
                          <th className="px-3 py-2">Completion Rate</th>
                          <th className="px-3 py-2">Download Rate</th>
                          <th className="px-3 py-2">Ad CTR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {sessionDepth.map((d: any) => (
                          <tr key={d.depthCategory} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-bold text-white">{d.depthCategory}</td>
                            <td className="px-3 py-2 text-slate-200">{d.sessionCount} ({d.percentageOfSessions}%)</td>
                            <td className="px-3 py-2 font-bold text-emerald-400">{d.completionRate}%</td>
                            <td className="px-3 py-2 text-purple-400">{d.downloadRate}%</td>
                            <td className="px-3 py-2 text-cyan-400">{d.adCtr}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Cross-Utility Flows */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cross-Utility Transition Flows</h3>
                    <p className="text-[11px] text-slate-500">Top sequential utility pathways discovered by visitors</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Pathway</th>
                          <th className="px-3 py-2">Transitions</th>
                          <th className="px-3 py-2">Transition Rate</th>
                          <th className="px-3 py-2">Target Completion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {crossUtilityFlows.length > 0 ? (
                          crossUtilityFlows.slice(0, 8).map((f: any) => (
                            <tr key={`${f.sourceUtilitySlug}->${f.targetUtilitySlug}`} className="hover:bg-slate-800/30">
                              <td className="px-3 py-2 text-slate-200">
                                <span className="font-semibold text-indigo-300">{f.sourceUtilityName}</span>
                                <span className="text-slate-500 mx-1.5">&rarr;</span>
                                <span className="font-semibold text-emerald-300">{f.targetUtilityName}</span>
                              </td>
                              <td className="px-3 py-2 font-bold text-white">{f.transitionCount}</td>
                              <td className="px-3 py-2 text-cyan-400">{f.transitionRate}%</td>
                              <td className="px-3 py-2 text-emerald-400 font-bold">{f.targetCompletionRate}%</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500 italic">No multi-tool transitions recorded yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Acquisition & Device Retention Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Acquisition Retention */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acquisition Source Retention</h3>
                    <p className="text-[11px] text-slate-500">Returning behavior and journey quality by traffic channel</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2">Visitors</th>
                          <th className="px-3 py-2">Return Rate</th>
                          <th className="px-3 py-2">D1 Rate</th>
                          <th className="px-3 py-2">Journey Quality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {acquisitionRetention.length > 0 ? (
                          acquisitionRetention.map((a: any) => (
                            <tr key={a.source} className="hover:bg-slate-800/30">
                              <td className="px-3 py-2 font-bold text-white">{a.source}</td>
                              <td className="px-3 py-2 text-slate-200">{a.visitors}</td>
                              <td className="px-3 py-2 text-cyan-400">{a.returnRate}%</td>
                              <td className="px-3 py-2 text-indigo-400">{a.d1Rate}%</td>
                              <td className="px-3 py-2 font-bold text-emerald-400">{a.journeyQualityScore}/100</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-slate-500 italic">No acquisition retention data available.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Device Retention */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Device Experience Retention</h3>
                    <p className="text-[11px] text-slate-500">Cross-device retention and task completion comparison</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Device</th>
                          <th className="px-3 py-2">Sessions</th>
                          <th className="px-3 py-2">Return Rate</th>
                          <th className="px-3 py-2">Completion Rate</th>
                          <th className="px-3 py-2">Download Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {deviceRetention.map((d: any) => (
                          <tr key={d.device} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-bold text-white">{d.device}</td>
                            <td className="px-3 py-2 text-slate-200">{d.sessionCount}</td>
                            <td className="px-3 py-2 text-cyan-400">{d.returnRate}%</td>
                            <td className="px-3 py-2 font-bold text-emerald-400">{d.completionRate}%</td>
                            <td className="px-3 py-2 text-purple-400">{d.downloadRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Experiment Journey Impact */}
              {experimentImpacts.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Experiment Journey & Retention Impact</h3>
                    <p className="text-[11px] text-slate-500">Observed variant trajectory on task completion and multi-tool progression</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-4 py-2.5">Experiment</th>
                          <th className="px-4 py-2.5">Variant</th>
                          <th className="px-4 py-2.5">Exposures</th>
                          <th className="px-4 py-2.5">Completion Rate</th>
                          <th className="px-4 py-2.5">Multi-Tool Rate</th>
                          <th className="px-4 py-2.5">Observed Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {experimentImpacts.map((e: any) => (
                          <tr key={`${e.experimentId}-${e.variantId}`} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2 font-bold text-white">{e.experimentName}</td>
                            <td className="px-4 py-2 font-bold text-cyan-400">{e.variantName}</td>
                            <td className="px-4 py-2 text-slate-200">{e.exposures}</td>
                            <td className="px-4 py-2 font-bold text-emerald-400">{e.completionRate}%</td>
                            <td className="px-4 py-2 text-indigo-400">{e.multiUtilityRate}%</td>
                            <td className="px-4 py-2 text-slate-400 text-[11px] italic">{e.observedImpact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEO CONTENT INTELLIGENCE & ORGANIC GROWTH ENGINE */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              {/* Executive SEO Overview & Health Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SEO Health Score Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">SEO Health Index</h2>
                      <p className="text-[11px] text-slate-400">Deterministic metadata & technical crawl health</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        seoHealth?.status === 'HEALTHY'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : seoHealth?.status === 'WARNING'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {seoHealth?.status || 'HEALTHY'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-white">{seoHealth?.overallScore ?? 90}</span>
                    <span className="text-xs text-slate-400 font-mono">/ 100 Health</span>
                  </div>

                  <div className="space-y-2.5 pt-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Metadata Completeness</span>
                        <span className="font-mono text-white">{seoHealth?.components?.metadataCompleteness ?? 100}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${seoHealth?.components?.metadataCompleteness ?? 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Canonical & Indexation Consistency</span>
                        <span className="font-mono text-white">{seoHealth?.components?.canonicalConsistency ?? 100}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${seoHealth?.components?.canonicalConsistency ?? 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Internal Linking Architecture</span>
                        <span className="font-mono text-white">{seoHealth?.components?.internalLinkingHealth ?? 95}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${seoHealth?.components?.internalLinkingHealth ?? 95}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Structured Data (JSON-LD & Breadcrumbs)</span>
                        <span className="font-mono text-white">{seoHealth?.components?.structuredDataHealth ?? 100}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${seoHealth?.components?.structuredDataHealth ?? 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Organic KPIs Summary */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md lg:col-span-2 space-y-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">Organic Acquisition Performance</h2>
                      <p className="text-[11px] text-slate-400">First-party organic search & referral acquisition telemetry</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                      Organic Share: {seoOrganicOverview?.organicTrafficPercentage ?? 0}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Organic Views</span>
                      <div className="text-xl font-black text-white">{seoOrganicOverview?.organicPageViews?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-500">Landing entries</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-blue-400 uppercase">Tool Starts</span>
                      <div className="text-xl font-black text-blue-400">{seoOrganicOverview?.organicToolStarts?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{seoOrganicOverview?.organicViewToStartRate ?? 0}% start rate</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Completions</span>
                      <div className="text-xl font-black text-emerald-400">{seoOrganicOverview?.organicCompletions?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{seoOrganicOverview?.organicConversionRate ?? 0}% conversion</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-bold text-purple-400 uppercase">Downloads</span>
                      <div className="text-xl font-black text-purple-400">{seoOrganicOverview?.organicDownloads?.toLocaleString() ?? 0}</div>
                      <span className="text-[10px] text-slate-400">{seoOrganicOverview?.organicCompleteToDownloadRate ?? 0}% export rate</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>Sitemap Status: <strong className="text-emerald-400">{seoSitemap?.activeUtilitiesIncluded ?? 18} Utilities</strong> & <strong className="text-emerald-400">{seoSitemap?.activeCategoriesIncluded ?? 6} Categories</strong> indexed in XML</span>
                    <span className="text-[11px] text-indigo-400 font-semibold">{seoOpportunities.length} SEO Opportunities Identified</span>
                  </div>
                </div>
              </div>

              {/* SEO Opportunities Queue */}
              {seoOpportunities.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Deterministic SEO Opportunity Queue
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Explainable internal growth & indexation prioritization (0–100 opportunity score)</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{seoOpportunities.length} opportunities</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {seoOpportunities.map((opp: any) => (
                      <div
                        key={opp.id}
                        className={`border rounded-lg p-4 space-y-2.5 transition-all ${
                          opp.priority === 'HIGH'
                            ? 'bg-rose-950/20 border-rose-800/60'
                            : opp.priority === 'MEDIUM'
                            ? 'bg-amber-950/20 border-amber-800/60'
                            : 'bg-slate-950/40 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                              opp.priority === 'HIGH'
                                ? 'bg-rose-900/60 text-rose-300'
                                : opp.priority === 'MEDIUM'
                                ? 'bg-amber-900/60 text-amber-300'
                                : 'bg-indigo-900/60 text-indigo-300'
                            }`}
                          >
                            {opp.priority} • {opp.opportunityType}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Score: {opp.score}/100</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">/{opp.utilitySlug}</span>
                            <span className="text-[10px] text-slate-400">({opp.categorySlug})</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1">{opp.reason}</p>
                        </div>
                        <div className="text-[11px] text-slate-300 bg-indigo-950/30 border border-indigo-900/40 p-2 rounded">
                          <strong className="text-indigo-400 font-semibold">Recommended Action: </strong>
                          {opp.recommendedAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Utility SEO & Organic Performance Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utility Organic Acquisition & Funnel Performance</h3>
                    <p className="text-[11px] text-slate-500">First-party organic search visits, start conversions, and export throughput</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Utility</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Total Views</th>
                        <th className="px-4 py-2.5">Organic Views</th>
                        <th className="px-4 py-2.5">Organic Starts</th>
                        <th className="px-4 py-2.5">Organic Completions</th>
                        <th className="px-4 py-2.5">Organic Downloads</th>
                        <th className="px-4 py-2.5">Completion Rate</th>
                        <th className="px-4 py-2.5">Organic Conv.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {seoUtilityPerformance.length > 0 ? (
                        seoUtilityPerformance.map((u: any) => (
                          <tr key={u.utilitySlug} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2">
                              <span className="font-bold text-white block">{u.name}</span>
                              <span className="text-[10px] text-slate-500">/{u.utilitySlug}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-400">{u.categorySlug}</td>
                            <td className="px-4 py-2 text-slate-200">{u.pageViews.toLocaleString()}</td>
                            <td className="px-4 py-2 font-bold text-cyan-400">{u.organicPageViews.toLocaleString()}</td>
                            <td className="px-4 py-2 text-blue-400">{u.toolStarts.toLocaleString()}</td>
                            <td className="px-4 py-2 text-emerald-400">{u.completions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-purple-400">{u.downloads.toLocaleString()}</td>
                            <td className="px-4 py-2 font-bold text-emerald-400">{u.completionRate}%</td>
                            <td className="px-4 py-2 font-bold text-cyan-400">{u.organicConversionRate}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-4 py-4 text-center text-slate-500 italic">No utility SEO data recorded in this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Coverage & Internal Linking Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Coverage Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category Landing-Page & Content Coverage</h3>
                    <p className="text-[11px] text-slate-500">Structured category index status & organic aggregation</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Tools</th>
                          <th className="px-3 py-2">Organic Views</th>
                          <th className="px-3 py-2">Completions</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {seoCategoryPerformance.map((c: any) => (
                          <tr key={c.categorySlug} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-bold text-white">{c.name}</td>
                            <td className="px-3 py-2 text-slate-200">{c.activeUtilitiesCount}</td>
                            <td className="px-3 py-2 text-cyan-400">{c.organicPageViews.toLocaleString()}</td>
                            <td className="px-3 py-2 text-emerald-400">{c.completions.toLocaleString()}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  c.coverageStatus === 'COMPLETE'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                                }`}
                              >
                                {c.coverageStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Internal Linking Recommendations */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Internal Link Architecture Recommendations</h3>
                    <p className="text-[11px] text-slate-500">Reciprocal and cross-category workflow pathways</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Source &rarr; Target</th>
                          <th className="px-3 py-2">Relationship</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {seoInternalLinks.slice(0, 8).map((link: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 text-slate-200">
                              <span className="font-semibold text-indigo-300">{link.sourceUtilitySlug}</span>
                              <span className="text-slate-500 mx-1.5">&rarr;</span>
                              <span className="font-semibold text-emerald-300">{link.targetUtilitySlug}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-400 text-[10px]">{link.relationshipType}</td>
                            <td className="px-3 py-2 text-slate-400 text-[10px] max-w-[160px] truncate" title={link.reason}>{link.reason}</td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                                {link.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FUNNEL & CONVERSION */}
          {activeTab === 'funnel' && (
            <div className="space-y-6">
              {/* Funnel KPI Cards */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide uppercase">Utility Conversion Funnel</h2>
                    <p className="text-xs text-slate-400">Step-by-step conversion from landing to result download</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                    End-to-End Conversion: {funnel?.overallConversionRate ?? 0}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Page Views</span>
                    <div className="text-2xl font-black text-white">{funnel?.pageViews?.toLocaleString() ?? 0}</div>
                    <div className="text-[11px] text-slate-500">Landing views</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">2. Tool Starts</span>
                    <div className="text-2xl font-black text-blue-400">{funnel?.toolStarts?.toLocaleString() ?? 0}</div>
                    <div className="text-[11px] text-slate-400">{funnel?.viewToStartRate ?? 0}% of page views</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">3. Completions</span>
                    <div className="text-2xl font-black text-emerald-400">{funnel?.toolCompletions?.toLocaleString() ?? 0}</div>
                    <div className="text-[11px] text-slate-400">{funnel?.startToCompleteRate ?? 0}% completion rate</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">4. Result Downloads</span>
                    <div className="text-2xl font-black text-purple-400">{funnel?.resultDownloads?.toLocaleString() ?? 0}</div>
                    <div className="text-[11px] text-slate-400">{funnel?.completeToDownloadRate ?? 0}% export rate</div>
                  </div>
                </div>
              </div>

              {/* Stage Drop-off Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Funnel Stage Progression & Drop-off Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {funnel?.stages?.map((stage: any, idx: number) => (
                    <div key={idx} className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{stage.stage}</span>
                        <span className="font-mono text-slate-400">{stage.count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, stage.conversionRate)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                        <span>Conv: <span className="text-emerald-400">{stage.conversionRate}%</span></span>
                        <span>Drop: <span className="text-rose-400">{stage.dropOffRate}%</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACQUISITION & ATTRIBUTION */}
          {activeTab === 'acquisition' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direct Traffic Visits</span>
                  <div className="text-2xl font-black text-white">{acquisition?.directVisits?.toLocaleString() ?? 0}</div>
                  <div className="text-[11px] text-slate-500">Unattributed direct / organic entries</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">UTM Campaign Visits</span>
                  <div className="text-2xl font-black text-indigo-400">{acquisition?.campaignVisits?.toLocaleString() ?? 0}</div>
                  <div className="text-[11px] text-slate-400">Attributed marketing campaigns</div>
                </div>
              </div>

              {/* UTM Source Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acquisition by Traffic Source</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Source</th>
                        <th className="px-4 py-2.5">Visits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {acquisition?.sources?.length > 0 ? (
                        acquisition.sources.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2 font-bold text-white">{s.source}</td>
                            <td className="px-4 py-2 text-slate-300">{s.visits.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-4 py-4 text-center text-slate-500 italic">No acquisition traffic recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UTILITY INTELLIGENCE */}
          {activeTab === 'utilities' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utility Performance Matrix</h3>
                  <span className="text-[11px] text-slate-500">{utilities.length} utilities tracked</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Utility</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Page Views</th>
                        <th className="px-4 py-2.5">Starts</th>
                        <th className="px-4 py-2.5">Completions</th>
                        <th className="px-4 py-2.5">Errors</th>
                        <th className="px-4 py-2.5">Downloads</th>
                        <th className="px-4 py-2.5">Completion Rate</th>
                        <th className="px-4 py-2.5">Error Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {utilities.length > 0 ? (
                        utilities.map((u: any) => (
                          <tr key={u.utilitySlug} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2">
                              <span className="font-bold text-white block">{u.name}</span>
                              <span className="text-[10px] text-slate-500">/{u.utilitySlug}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-400">{u.categorySlug || '—'}</td>
                            <td className="px-4 py-2 text-slate-200">{u.pageViews.toLocaleString()}</td>
                            <td className="px-4 py-2 text-blue-400">{u.toolStarts.toLocaleString()}</td>
                            <td className="px-4 py-2 text-emerald-400">{u.toolCompletions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-rose-400">{u.toolErrors.toLocaleString()}</td>
                            <td className="px-4 py-2 text-purple-400">{u.resultDownloads.toLocaleString()}</td>
                            <td className="px-4 py-2 font-bold text-emerald-400">{u.completionRate}%</td>
                            <td className="px-4 py-2 font-semibold text-rose-400">{u.errorRate}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-4 py-4 text-center text-slate-500 italic">No utility events recorded in this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AD MONETIZATION */}
          {activeTab === 'monetization' && (
            <div className="space-y-6">
              {/* Real Monetization & Provider Health Header Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white tracking-wide uppercase">Real Monetization & Ad Network</h2>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        monetization?.providerHealth?.health === 'HEALTHY'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : monetization?.providerHealth?.health === 'DEGRADED'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        Provider: {monetization?.providerHealth?.provider || 'MOCK'} ({monetization?.providerHealth?.status || 'CONFIGURED'})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Authoritative external revenue reports & first-party delivery telemetry</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncRevenue}
                      disabled={syncing}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      {syncing ? 'Syncing...' : 'Sync Provider Revenue'}
                    </button>
                  </div>
                </div>

                {syncMessage && (
                  <div className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-200">
                    {syncMessage}
                  </div>
                )}

                {/* Financial Truth & Revenue KPI Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verified Revenue</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        monetization?.actualRevenueStatus === 'ACTUAL'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {monetization?.actualRevenueStatus === 'ACTUAL' ? 'ACTUAL' : 'UNAVAILABLE'}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">
                      {monetization?.actualRevenueStatus === 'ACTUAL' && monetization?.actualRevenueTotal !== null
                        ? `$${monetization.actualRevenueTotal.toFixed(2)}`
                        : 'Unavailable'}
                    </div>
                    <div className="text-[11px] text-slate-500">Authoritative provider report</div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Impressions</span>
                    <div className="text-2xl font-black text-white">{monetization?.summary?.totalImpressions ?? monetization?.totalImpressions ?? 0}</div>
                    <div className="text-[11px] text-slate-500">First-party delivery events</div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Total Clicks</span>
                    <div className="text-2xl font-black text-cyan-400">{monetization?.summary?.totalClicks ?? monetization?.totalClicks ?? 0}</div>
                    <div className="text-[11px] text-slate-400">Authoritative click interactions</div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Provider Fallback Rate</span>
                    <div className="text-2xl font-black text-purple-400">{monetization?.providerHealth?.fallbackRate ?? 0}%</div>
                    <div className="text-[11px] text-slate-400">Fail-open execution resilience</div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 italic">
                  Financial Data Truth Policy: Revenue and eCPM are never fabricated or estimated. Verified revenue is ingested strictly from authoritative external provider reports.
                </div>
              </div>

              {/* Dimensional Revenue Breakdown (if actual revenue exists) */}
              {monetization?.actualRevenueStatus === 'ACTUAL' && monetization?.actualRevenueTotal !== null && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Revenue by Placement */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-3">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Revenue by Placement</h4>
                    <div className="space-y-2 font-mono text-xs">
                      {Object.entries(monetization?.revenueByPlacement || {}).map(([pl, rev]: [string, any]) => (
                        <div key={pl} className="flex justify-between items-center py-1 border-b border-slate-800/60">
                          <span className="text-cyan-400">{pl}</span>
                          <span className="text-emerald-400 font-bold">${rev.toFixed(2)}</span>
                        </div>
                      ))}
                      {Object.keys(monetization?.revenueByPlacement || {}).length === 0 && (
                        <div className="text-slate-500 text-xs italic">No placement breakdown available</div>
                      )}
                    </div>
                  </div>

                  {/* Revenue by Utility */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-3">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Revenue by Utility</h4>
                    <div className="space-y-2 font-mono text-xs">
                      {Object.entries(monetization?.revenueByUtility || {}).map(([ut, rev]: [string, any]) => (
                        <div key={ut} className="flex justify-between items-center py-1 border-b border-slate-800/60">
                          <span className="text-slate-300">/{ut}</span>
                          <span className="text-emerald-400 font-bold">${rev.toFixed(2)}</span>
                        </div>
                      ))}
                      {Object.keys(monetization?.revenueByUtility || {}).length === 0 && (
                        <div className="text-slate-500 text-xs italic">No utility breakdown available</div>
                      )}
                    </div>
                  </div>

                  {/* Revenue by Device */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-3">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Revenue by Device</h4>
                    <div className="space-y-2 font-mono text-xs">
                      {Object.entries(monetization?.revenueByDevice || {}).map(([dev, rev]: [string, any]) => (
                        <div key={dev} className="flex justify-between items-center py-1 border-b border-slate-800/60">
                          <span className="text-indigo-400">{dev}</span>
                          <span className="text-emerald-400 font-bold">${rev.toFixed(2)}</span>
                        </div>
                      ))}
                      {Object.keys(monetization?.revenueByDevice || {}).length === 0 && (
                        <div className="text-slate-500 text-xs italic">No device breakdown available</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Placement Yield Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Placement Yield & Optimization Matrix</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Placement Code</th>
                        <th className="px-4 py-2.5">Name</th>
                        <th className="px-4 py-2.5">Impressions</th>
                        <th className="px-4 py-2.5">Clicks</th>
                        <th className="px-4 py-2.5">CTR</th>
                        <th className="px-4 py-2.5">Optimization Score</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {monetization?.placementYield?.map((p: any) => (
                        <tr key={p.placementCode} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2 font-bold text-cyan-400">{p.placementCode}</td>
                          <td className="px-4 py-2 text-slate-300">{p.name || '—'}</td>
                          <td className="px-4 py-2 text-slate-200">{p.impressions.toLocaleString()}</td>
                          <td className="px-4 py-2 text-slate-200">{p.clicks.toLocaleString()}</td>
                          <td className="px-4 py-2 font-bold text-emerald-400">{p.ctr}%</td>
                          <td className="px-4 py-2 font-bold text-white">{p.optimizationScore}/100</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: A/B EXPERIMENTATION */}
          {activeTab === 'experiments' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide uppercase">Active A/B Experiments</h2>
                    <p className="text-xs text-slate-400">Deterministic session-hashed experimentation matrix</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    {experiments.length} Active Experiments
                  </span>
                </div>

                <div className="space-y-6">
                  {experiments.map((exp: any) => (
                    <div key={exp.experimentId} className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="font-bold text-white text-sm">{exp.name}</span>
                        <span className="text-[11px] text-slate-400">Total Exposures: {exp.totalExposures.toLocaleString()}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                            <tr>
                              <th className="px-4 py-2">Variant</th>
                              <th className="px-4 py-2">Exposures</th>
                              <th className="px-4 py-2">Conversions</th>
                              <th className="px-4 py-2">Conversion Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                            {exp.variants?.map((v: any) => (
                              <tr key={v.variantId} className="hover:bg-slate-900/40">
                                <td className="px-4 py-2 font-bold text-cyan-400">{v.name}</td>
                                <td className="px-4 py-2 text-slate-200">{v.exposures.toLocaleString()}</td>
                                <td className="px-4 py-2 text-slate-200">{v.conversions.toLocaleString()}</td>
                                <td className="px-4 py-2 font-bold text-emerald-400">{v.conversionRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LIVE TELEMETRY STREAM */}
          {activeTab === 'telemetry' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Live Telemetry Event Stream</h3>
                  <span className="text-xs text-slate-500">Showing recent 50 events</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Event Type</th>
                        <th className="px-4 py-2.5">Utility Slug</th>
                        <th className="px-4 py-2.5">Session ID</th>
                        <th className="px-4 py-2.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {recentEvents.map((e: any) => (
                        <tr key={e.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2 font-bold text-indigo-400">{e.eventType}</td>
                          <td className="px-4 py-2 text-slate-300">{e.utilitySlug || '—'}</td>
                          <td className="px-4 py-2 text-slate-500 truncate max-w-[150px]">
                            {e.sessionToken ? `anon_${e.sessionToken.slice(0, 6)}...` : 'anonymous'}
                          </td>
                          <td className="px-4 py-2 text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
