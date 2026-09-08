'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminTargetingPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRules = async () => {
    setLoading(true);
    const res = await adminApiFetch('/admin/ads/targeting');
    if (res.success && res.data) {
      setRules(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this targeting rule?')) return;
    const res = await adminApiFetch(`/admin/ads/targeting/${id}`, { method: 'DELETE' });
    if (res.success) {
      loadRules();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Ad Targeting Rules</h1>
        <p className="text-xs text-slate-400 mt-1">Multi-device, category, and utility delivery conditions for campaigns</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading targeting rules...</div>
        ) : rules.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No targeting rules found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Placement</th>
                  <th className="px-4 py-3">Creative</th>
                  <th className="px-4 py-3">Devices</th>
                  <th className="px-4 py-3">Scope (Utilities/Categories)</th>
                  <th className="px-4 py-3">Priority / Weight</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{r.campaign?.name}</td>
                    <td className="px-4 py-3 font-mono text-indigo-400">{r.placement?.code}</td>
                    <td className="px-4 py-3 text-slate-300">{r.creative?.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {r.deviceTypes?.map((d: string) => (
                          <span key={d} className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {r.utilitySlugs?.length > 0 ? (
                        <span>Tools: {r.utilitySlugs.join(', ')}</span>
                      ) : r.categorySlugs?.length > 0 ? (
                        <span>Cat: {r.categorySlugs.join(', ')}</span>
                      ) : (
                        <span>Global / All Tools</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {r.priorityOverride || r.campaign?.priority || 50} / {r.weight}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-rose-400 hover:text-rose-300 text-[11px]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
