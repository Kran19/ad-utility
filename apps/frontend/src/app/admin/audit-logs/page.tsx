'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    let path = '/admin/audit-logs?page=1&pageSize=50';
    if (search) path += `&search=${encodeURIComponent(search)}`;
    if (actionFilter) path += `&action=${encodeURIComponent(actionFilter)}`;

    const res = await adminApiFetch(path);
    if (res.success && res.data) {
      setLogs(res.data.items || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [search, actionFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Audit Trail</h1>
        <p className="text-xs text-slate-400 mt-1">Immutable security ledger recording administrative mutations, logins, and configurations</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <input
          type="text"
          placeholder="Search by action, actor, or entity..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No audit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor Email</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-indigo-400">{l.action}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{l.entityType}</td>
                    <td className="px-4 py-3 text-slate-300">{l.actorEmail || 'System'}</td>
                    <td className="px-4 py-3 text-slate-500">{l.actorIp || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-[200px]">
                      {l.details ? JSON.stringify(l.details) : '—'}
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
