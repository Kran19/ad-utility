'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminPlacementsPage() {
  const [placements, setPlacements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await adminApiFetch('/admin/ads/placements');
      if (res.success && res.data) {
        setPlacements(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Ad Placement Slots</h1>
        <p className="text-xs text-slate-400 mt-1">Standardized inventory slots and supported creative formats across public pages</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="py-20 col-span-2 text-center text-xs text-slate-400">Loading placements...</div>
        ) : (
          placements.map((p) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                  {p.code}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {p._count?.targetingRules || 0} active rules
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{p.description || 'No description'}</p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500">Formats:</span>
                {p.supportedTypes?.map((t: string) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
