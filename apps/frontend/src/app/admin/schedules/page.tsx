'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = async () => {
    setLoading(true);
    const res = await adminApiFetch('/admin/ads/schedules');
    if (res.success && res.data) {
      setSchedules(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    const res = await adminApiFetch(`/admin/ads/schedules/${id}`, { method: 'DELETE' });
    if (res.success) {
      loadSchedules();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Campaign Delivery Schedules</h1>
        <p className="text-xs text-slate-400 mt-1">Day-of-week and UTC hour time windows for delivery pacing</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No custom schedules defined. Campaigns run 24/7 by default.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Day of Week</th>
                  <th className="px-4 py-3">Hours Window (UTC)</th>
                  <th className="px-4 py-3">Timezone</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{s.campaign?.name}</td>
                    <td className="px-4 py-3 font-mono text-indigo-400">{DAYS[s.dayOfWeek] || s.dayOfWeek}</td>
                    <td className="px-4 py-3 font-mono">{s.startHour}:00 &ndash; {s.endHour}:00</td>
                    <td className="px-4 py-3 text-slate-400">{s.timezone}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(s.id)}
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
