'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    status: 'ACTIVE',
    priority: 50,
    weight: 100,
    dailyImpressionCap: '',
  });

  const loadCampaigns = async () => {
    setLoading(true);
    let path = '/admin/ads/campaigns?page=1&pageSize=50';
    if (search) path += `&search=${encodeURIComponent(search)}`;
    if (statusFilter) path += `&status=${encodeURIComponent(statusFilter)}`;

    const res = await adminApiFetch(path);
    if (res.success && res.data) {
      setCampaigns(res.data.items || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
  }, [search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: newCampaign.name,
      status: newCampaign.status,
      priority: Number(newCampaign.priority),
      weight: Number(newCampaign.weight),
    };
    if (newCampaign.dailyImpressionCap) {
      payload.dailyImpressionCap = Number(newCampaign.dailyImpressionCap);
    }

    const res = await adminApiFetch('/admin/ads/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setShowModal(false);
      setNewCampaign({ name: '', status: 'ACTIVE', priority: 50, weight: 100, dailyImpressionCap: '' });
      loadCampaigns();
    } else {
      alert(res.error || 'Failed to create campaign');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const res = await adminApiFetch(`/admin/ads/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.success) {
      loadCampaigns();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete campaign "${name}"?`)) return;
    const res = await adminApiFetch(`/admin/ads/campaigns/${id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      loadCampaigns();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Campaign Management</h1>
          <p className="text-xs text-slate-400 mt-1">Manage advertising campaigns, priorities, weighting, and schedules</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span> Create Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="PAUSED">Paused</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No campaigns found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Campaign Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Daily Cap</th>
                  <th className="px-4 py-3">Targeting Rules</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{c.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.status === 'PAUSED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{c.priority}</td>
                    <td className="px-4 py-3 font-mono">{c.weight}</td>
                    <td className="px-4 py-3 font-mono">{c.dailyImpressionCap || 'Unlimited'}</td>
                    <td className="px-4 py-3 font-mono">{c._count?.targetingRules || 0}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleToggleStatus(c.id, c.status)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
                      >
                        {c.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-[11px] transition-colors"
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Create New Campaign</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Priority (0-1000)</label>
                  <input
                    type="number"
                    value={newCampaign.priority}
                    onChange={(e) => setNewCampaign({ ...newCampaign, priority: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Weight (1-1000)</label>
                  <input
                    type="number"
                    value={newCampaign.weight}
                    onChange={(e) => setNewCampaign({ ...newCampaign, weight: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Daily Impression Cap (Optional)</label>
                <input
                  type="number"
                  placeholder="Unlimited"
                  value={newCampaign.dailyImpressionCap}
                  onChange={(e) => setNewCampaign({ ...newCampaign, dailyImpressionCap: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 text-xs hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
