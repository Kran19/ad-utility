'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminUtilitiesPage() {
  const [utilities, setUtilities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newUtility, setNewUtility] = useState({
    slug: '',
    name: '',
    description: '',
    categoryId: '',
    implementationMode: 'LOCAL',
    status: 'ACTIVE',
    isFeatured: false,
    seoTitle: '',
    seoDescription: '',
  });

  const loadData = async () => {
    setLoading(true);
    let path = '/admin/utilities?page=1&pageSize=50';
    if (search) path += `&search=${encodeURIComponent(search)}`;
    if (statusFilter) path += `&status=${encodeURIComponent(statusFilter)}`;

    const [uRes, cRes] = await Promise.all([
      adminApiFetch(path),
      adminApiFetch('/admin/utilities/categories'),
    ]);

    if (uRes.success && uRes.data) {
      setUtilities(uRes.data.items || []);
    }
    if (cRes.success && cRes.data) {
      setCategories(cRes.data || []);
      if (cRes.data.length > 0 && !newUtility.categoryId) {
        setNewUtility((prev) => ({ ...prev, categoryId: cRes.data[0].id }));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminApiFetch('/admin/utilities', {
      method: 'POST',
      body: JSON.stringify(newUtility),
    });

    if (res.success) {
      setShowModal(false);
      setNewUtility({
        slug: '',
        name: '',
        description: '',
        categoryId: categories[0]?.id || '',
        implementationMode: 'LOCAL',
        status: 'ACTIVE',
        isFeatured: false,
        seoTitle: '',
        seoDescription: '',
      });
      loadData();
    } else {
      alert(res.error || 'Failed to create utility');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    let nextStatus = 'ACTIVE';
    if (currentStatus === 'ACTIVE') nextStatus = 'DRAFT';
    else if (currentStatus === 'DRAFT') nextStatus = 'DISABLED';
    else nextStatus = 'ACTIVE';

    const res = await adminApiFetch(`/admin/utilities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.success) {
      loadData();
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    const res = await adminApiFetch(`/admin/utilities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isFeatured: !isFeatured }),
    });
    if (res.success) {
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Utility Registry Management</h1>
          <p className="text-xs text-slate-400 mt-1">Manage database metadata, categories, SEO tags, and publication statuses</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span> Register Utility
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <input
          type="text"
          placeholder="Search utilities..."
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
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading utilities...</div>
        ) : utilities.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No utilities found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Tool Name & Slug</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Execution Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {utilities.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{u.name}</div>
                      <div className="text-[11px] text-indigo-400 font-mono">/{u.slug}</div>
                    </td>
                    <td className="px-4 py-3">{u.category?.name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{u.implementationMode}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(u.id, u.status)}
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-colors ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : u.status === 'DRAFT'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                      >
                        {u.status} ⟳
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleFeatured(u.id, u.isFeatured)}
                        className={`text-xs ${u.isFeatured ? 'text-amber-400' : 'text-slate-600'}`}
                      >
                        {u.isFeatured ? '★ Featured' : '☆ Standard'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/${u.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
                      >
                        View Page &rarr;
                      </a>
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
              <h2 className="text-base font-bold text-white">Register Utility Metadata</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Tool Name</label>
                <input
                  type="text"
                  required
                  value={newUtility.name}
                  onChange={(e) => setNewUtility({ ...newUtility, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">URL Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="my-tool"
                    value={newUtility.slug}
                    onChange={(e) => setNewUtility({ ...newUtility, slug: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Category</label>
                  <select
                    value={newUtility.categoryId}
                    onChange={(e) => setNewUtility({ ...newUtility, categoryId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  required
                  value={newUtility.description}
                  onChange={(e) => setNewUtility({ ...newUtility, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">SEO Title</label>
                <input
                  type="text"
                  required
                  value={newUtility.seoTitle}
                  onChange={(e) => setNewUtility({ ...newUtility, seoTitle: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">SEO Description</label>
                <input
                  type="text"
                  required
                  value={newUtility.seoDescription}
                  onChange={(e) => setNewUtility({ ...newUtility, seoDescription: e.target.value })}
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
                  Save Metadata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
