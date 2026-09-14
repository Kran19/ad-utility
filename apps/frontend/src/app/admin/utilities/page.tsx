'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApiFetch } from '../../../lib/admin-api';

interface UtilityAdCounts {
  desktop: number;
  tablet: number;
  mobile: number;
  total: number;
}

interface UtilityItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  category?: { id: string; name: string; slug: string };
  implementationMode: string;
  status: 'ACTIVE' | 'DISABLED' | 'DRAFT';
  isFeatured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  adCounts?: UtilityAdCounts;
}

const getCategoryIcon = (slug?: string) => {
  switch (slug) {
    case 'image-tools':
    case 'image':
      return '🖼️';
    case 'pdf-tools':
    case 'pdf':
      return '📄';
    case 'text-tools':
    case 'text':
      return '✍️';
    case 'developer-tools':
    case 'dev':
      return '💻';
    case 'ai-tools':
    case 'ai':
      return '✨';
    case 'video-tools':
    case 'video':
      return '🎬';
    case 'audio-tools':
    case 'audio':
      return '🎵';
    case 'qr-barcode-tools':
    case 'qr':
      return '📱';
    default:
      return '⚡';
  }
};

export default function AdminUtilitiesPage() {
  const [utilities, setUtilities] = useState<UtilityItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUtility, setEditingUtility] = useState<UtilityItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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
    setError(null);
    let path = '/admin/utilities?page=1&pageSize=100';
    if (search) path += `&search=${encodeURIComponent(search)}`;
    if (statusFilter) path += `&status=${encodeURIComponent(statusFilter)}`;
    if (categoryFilter) path += `&categoryId=${encodeURIComponent(categoryFilter)}`;

    const [uRes, cRes] = await Promise.all([
      adminApiFetch(path),
      adminApiFetch('/admin/utilities/categories'),
    ]);

    if (uRes.success && uRes.data) {
      setUtilities(uRes.data.items || []);
    } else if (!uRes.success) {
      setError(uRes.error || 'Failed to load utilities');
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
  }, [search, statusFilter, categoryFilter]);

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
    // Single binary toggle ACTIVE <-> DISABLED. DRAFT can be published to ACTIVE.
    let nextStatus = 'ACTIVE';
    if (currentStatus === 'ACTIVE') {
      nextStatus = 'DISABLED';
    } else {
      nextStatus = 'ACTIVE';
    }

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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUtility) return;
    setSavingEdit(true);

    const res = await adminApiFetch(`/admin/utilities/${editingUtility.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editingUtility.name,
        description: editingUtility.description,
        categoryId: editingUtility.categoryId,
        status: editingUtility.status,
        isFeatured: editingUtility.isFeatured,
        seoTitle: editingUtility.seoTitle,
        seoDescription: editingUtility.seoDescription,
      }),
    });

    setSavingEdit(false);
    if (res.success) {
      setEditingUtility(null);
      loadData();
    } else {
      alert(res.error || 'Failed to update utility');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Utility Registry Management</h1>
          <p className="text-xs text-slate-400 mt-1">Manage database metadata, categories, ad allocations, SEO tags, and publication statuses</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/ad-manager"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>🎛️</span> Ad Operations Matrix
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <span>+</span> Register Utility
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search utilities by name, slug or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
            <option value="DRAFT">DRAFT</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {(search || statusFilter || categoryFilter) && (
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60 text-slate-400">
            <span>Active filters applied</span>
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setCategoryFilter('');
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Category Wise Quick Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              📁 Category Wise Utilities
            </span>
            <span className="text-[11px] text-slate-500">
              (Click any category to filter registry utilities)
            </span>
          </div>
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter('')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold hover:underline flex items-center gap-1"
            >
              <span>View All Categories</span> &rarr;
            </button>
          )}
        </div>

        {/* Category Cards / Pills Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {/* All Button */}
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              !categoryFilter
                ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm ring-2 ring-indigo-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-base mb-1">🌐</div>
            <div>
              <div className="text-xs font-bold truncate">All Categories</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {utilities.length} tools
              </div>
            </div>
          </button>

          {categories.map((c) => {
            const isSelected = categoryFilter === c.id;
            const icon = getCategoryIcon(c.slug);
            const count = (c.utilities && c.utilities.length) || c.utilityCount || (c._count?.utilities) || 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setCategoryFilter('');
                  } else {
                    setCategoryFilter(c.id);
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm ring-2 ring-indigo-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-base mb-1">{icon}</div>
                <div>
                  <div className="text-xs font-bold truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {count > 0 ? `${count} tools` : 'Explore'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading utilities...</div>
        ) : error ? (
          <div className="py-16 text-center text-xs text-rose-400 px-4">
            <p className="font-semibold text-rose-300 mb-1">Failed to load utilities</p>
            <p className="text-slate-400 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors border border-slate-700"
            >
              Retry
            </button>
          </div>
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
                  <th className="px-4 py-3">Ads Assigned</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {utilities.map((u) => {
                  const adCounts = u.adCounts;
                  const hasAds = adCounts && adCounts.total > 0;
                  const catIcon = getCategoryIcon(u.category?.slug);
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditingUtility(u)}
                          className="text-left font-semibold text-white hover:text-indigo-400 transition-colors cursor-pointer group flex items-center gap-1.5"
                        >
                          <span>{u.name}</span>
                          <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                        </button>
                        <div className="text-[11px] text-indigo-400 font-mono">/{u.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.category ? (
                          <button
                            type="button"
                            onClick={() => setCategoryFilter(u.category!.id === categoryFilter ? '' : u.category!.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-300 transition-colors cursor-pointer text-[11px]"
                            title={`Filter by category: ${u.category.name}`}
                          >
                            <span>{catIcon}</span>
                            <span>{u.category.name}</span>
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{u.implementationMode}</td>
                      
                      {/* Ads Column */}
                      <td className="px-4 py-3">
                        {hasAds ? (
                          <Link
                            href={`/admin/ad-manager?utility=${u.slug}`}
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 transition-colors bg-indigo-950/40 border border-indigo-800/40 px-2 py-1 rounded-md"
                            title="Manage ads for this utility"
                          >
                            <span className="font-medium">
                              Desktop {adCounts.desktop} · Mobile {adCounts.mobile}
                              {adCounts.tablet > 0 ? ` · Tablet ${adCounts.tablet}` : ''}
                            </span>
                            <span className="text-[10px] text-indigo-400">&rarr;</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/ad-manager?utility=${u.slug}`}
                            className="text-slate-500 hover:text-slate-300 text-xs italic transition-colors"
                            title="Assign an ad"
                          >
                            No ads configured &rarr;
                          </Link>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-colors ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : u.status === 'DISABLED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                          }`}
                          title={`Click to toggle ${u.status === 'ACTIVE' ? 'to DISABLED' : 'to ACTIVE'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-400' : u.status === 'DISABLED' ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
                          {u.status} ⟳
                        </button>
                      </td>

                      {/* Featured Column */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleFeatured(u.id, u.isFeatured)}
                          className={`text-xs ${u.isFeatured ? 'text-amber-400' : 'text-slate-600'}`}
                        >
                          {u.isFeatured ? '★ Featured' : '☆ Standard'}
                        </button>
                      </td>

                      {/* Actions Column */}
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => setEditingUtility(u)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors border border-slate-700"
                        >
                          Edit
                        </button>
                        <a
                          href={`/${u.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors inline-block"
                        >
                          View &rarr;
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Utility Drawer/Modal */}
      {editingUtility && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Edit Utility Details</h2>
                <p className="text-xs text-slate-400">Update metadata, publication status, and SEO tags</p>
              </div>
              <button
                onClick={() => setEditingUtility(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Slug (Read-only)</label>
                  <input
                    type="text"
                    disabled
                    value={editingUtility.slug}
                    className="w-full mt-1 px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-xs text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Execution Mode (Read-only)</label>
                  <input
                    type="text"
                    disabled
                    value={editingUtility.implementationMode}
                    className="w-full mt-1 px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-xs text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Tool Name</label>
                <input
                  type="text"
                  required
                  value={editingUtility.name}
                  onChange={(e) => setEditingUtility({ ...editingUtility, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Category</label>
                  <select
                    value={editingUtility.categoryId}
                    onChange={(e) => setEditingUtility({ ...editingUtility, categoryId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Status</label>
                  <select
                    value={editingUtility.status}
                    onChange={(e) => setEditingUtility({ ...editingUtility, status: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  required
                  value={editingUtility.description}
                  onChange={(e) => setEditingUtility({ ...editingUtility, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">SEO Title</label>
                <input
                  type="text"
                  value={editingUtility.seoTitle || ''}
                  onChange={(e) => setEditingUtility({ ...editingUtility, seoTitle: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">SEO Description</label>
                <textarea
                  rows={2}
                  value={editingUtility.seoDescription || ''}
                  onChange={(e) => setEditingUtility({ ...editingUtility, seoDescription: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editFeatured"
                  checked={editingUtility.isFeatured}
                  onChange={(e) => setEditingUtility({ ...editingUtility, isFeatured: e.target.checked })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="editFeatured" className="text-xs text-slate-300">
                  Feature on homepage
                </label>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <Link
                  href={`/admin/ad-manager?utility=${editingUtility.slug}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>🎛️</span> Manage Ads for {editingUtility.name} &rarr;
                </Link>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUtility(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 text-xs hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Register Utility */}
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
