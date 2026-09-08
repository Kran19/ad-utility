'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminAiUsagePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await adminApiFetch(`/admin/ai/overview?days=${days}`);
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Gateway Usage & Cost Telemetry</h1>
          <p className="text-xs text-slate-400 mt-1">Monitor prompt token consumption, completion volume, latency, and estimated USD costs</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 self-start sm:self-auto"
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading AI telemetry...</div>
      ) : (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
              <div className="text-xs text-slate-400">Total Requests</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{(data?.totalRequests || 0).toLocaleString()}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
              <div className="text-xs text-slate-400">Total Tokens Processed</div>
              <div className="text-xl font-bold text-indigo-400 font-mono mt-1">{(data?.totalTokens || 0).toLocaleString()}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
              <div className="text-xs text-slate-400">Estimated Cost (USD)</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">${data?.totalCostUsd || 0}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
              <div className="text-xs text-slate-400">Average Latency</div>
              <div className="text-xl font-bold text-cyan-400 font-mono mt-1">{data?.avgLatencyMs || 0}ms</div>
            </div>
          </div>

          {/* Model Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
            <h3 className="text-sm font-semibold text-white">Usage Breakdown by Model</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Requests</th>
                    <th className="px-4 py-3">Total Tokens</th>
                    <th className="px-4 py-3">Estimated Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {data?.byModel?.map((m: any) => (
                    <tr key={m.model} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-indigo-400">{m.model}</td>
                      <td className="px-4 py-3 text-slate-200">{m.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-300">{m.totalTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-emerald-400 font-bold">${m.estimatedCostUsd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
