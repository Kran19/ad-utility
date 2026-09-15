'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApiFetch } from '../../../lib/admin-api';
import { useResizableColumns, ResizableTh } from '../../../components/admin/ResizableTable';

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

  // Excel-like Column Resizing Hook
  const { widths, activeColumn, handleMouseDown, resetColumnWidth, resetAllWidths, getColStyle } =
    useResizableColumns('admin_utilities_table', {
      name: 260,
      category: 180,
      mode: 120,
      ads: 230,
      status: 130,
      featured: 130,
      actions: 160,
    });

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
          <button
            type="button"
            onClick={resetAllWidths}
            title="Reset all column widths to default"
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-medium text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>↔️</span> Reset Columns
          </button>
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

      {/* Clean Category Quick Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>📁</span> Categories
            </span>
            <span className="text-xs text-slate-400">
              Filter utilities by category
            </span>
          </div>
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter('')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Show All ({utilities.length} tools)</span> &rarr;
            </button>
          )}
        </div>

        {/* Category Pills (Clean, Spacious Flex-Wrap) */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* All Categories Pill */}
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
              !categoryFilter
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700'
            }`}
          >
            <span>🌐</span>
            <span>All Tools</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
              !categoryFilter ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {utilities.length}
            </span>
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
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{icon}</span>
                <span>{c.name}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-xs text-slate-500">🔍</span>
            <input
              type="text"
              placeholder="Search utilities by name, slug or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 min-w-[130px]"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              <option value="DRAFT">Draft</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 min-w-[160px]"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(search || statusFilter || categoryFilter) && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-slate-400">
            <span>Filtered results: <strong className="text-white">{utilities.length}</strong> matching tools</span>
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

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-24 text-center text-xs text-slate-400 animate-pulse">Loading utilities catalog...</div>
        ) : error ? (
          <div className="py-20 text-center text-xs text-rose-400 px-4">
            <p className="font-semibold text-rose-300 mb-1">Failed to load utilities</p>
            <p className="text-slate-400 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs transition-colors border border-slate-700"
            >
              Retry
            </button>
          </div>
        ) : utilities.length === 0 ? (
          <div className="py-24 text-center text-xs text-slate-400 space-y-2">
            <div className="text-3xl">🔍</div>
            <p className="font-semibold text-white">No utilities found matching your filters.</p>
            <p className="text-slate-500">Try clearing filters or search term.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 table-fixed">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <ResizableTh
                    colKey="name"
                    width={widths.name}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'name'}
                    className="px-5 py-3.5"
                  >
                    Tool Name & Slug
                  </ResizableTh>
                  <ResizableTh
                    colKey="category"
                    width={widths.category}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'category'}
                    className="px-5 py-3.5"
                  >
                    Category
                  </ResizableTh>
                  <ResizableTh
                    colKey="mode"
                    width={widths.mode}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'mode'}
                    className="px-5 py-3.5"
                  >
                    Execution
                  </ResizableTh>
                  <ResizableTh
                    colKey="ads"
                    width={widths.ads}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'ads'}
                    className="px-5 py-3.5"
                  >
                    Ads Allocation
                  </ResizableTh>
                  <ResizableTh
                    colKey="status"
                    width={widths.status}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'status'}
                    className="px-5 py-3.5"
                  >
                    Status
                  </ResizableTh>
                  <ResizableTh
                    colKey="featured"
                    width={widths.featured}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'featured'}
                    className="px-5 py-3.5"
                  >
                    Featured
                  </ResizableTh>
                  <ResizableTh
                    colKey="actions"
                    width={widths.actions}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'actions'}
                    className="px-5 py-3.5 text-right"
                  >
                    Actions
                  </ResizableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {utilities.map((u) => {
                  const adCounts = u.adCounts;
                  const hasAds = adCounts && adCounts.total > 0;
                  const catIcon = getCategoryIcon(u.category?.slug);
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Tool Name & Slug */}
                      <td style={getColStyle('name')} className="px-5 py-4 overflow-hidden">
                        <button
                          onClick={() => setEditingUtility(u)}
                          className="text-left font-bold text-white hover:text-indigo-400 transition-colors cursor-pointer group flex items-center gap-1.5 truncate max-w-full"
                          title={u.name}
                        >
                          <span className="text-sm truncate">{u.name}</span>
                          <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✏️</span>
                        </button>
                        <div className="text-[11px] text-indigo-400 font-mono mt-0.5 truncate">/{u.slug}</div>
                      </td>

                      {/* Category */}
                      <td style={getColStyle('category')} className="px-5 py-4 whitespace-nowrap overflow-hidden">
                        {u.category ? (
                          <button
                            type="button"
                            onClick={() => setCategoryFilter(u.category!.id === categoryFilter ? '' : u.category!.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-300 transition-colors cursor-pointer text-xs font-medium max-w-full truncate"
                            title={`Filter by category: ${u.category.name}`}
                          >
                            <span>{catIcon}</span>
                            <span className="truncate">{u.category.name}</span>
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Execution Mode */}
                      <td style={getColStyle('mode')} className="px-5 py-4 whitespace-nowrap overflow-hidden">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-semibold text-slate-400">
                          {u.implementationMode}
                        </span>
                      </td>

                      {/* Ads Column */}
                      <td style={getColStyle('ads')} className="px-5 py-4 whitespace-nowrap overflow-hidden">
                        {hasAds ? (
                          <Link
                            href={`/admin/ad-manager?utility=${u.slug}`}
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white transition-colors bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/50 px-3 py-1.5 rounded-xl font-medium shadow-xs max-w-full"
                            title="Manage active ads for this utility"
                          >
                            <span>🎯</span>
                            <span className="truncate">
                              Desktop {adCounts.desktop} · Mobile {adCounts.mobile}
                              {adCounts.tablet > 0 ? ` · Tab ${adCounts.tablet}` : ''}
                            </span>
                            <span className="text-indigo-400 shrink-0">&rarr;</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/ad-manager?utility=${u.slug}`}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-300 text-xs transition-colors py-1 hover:underline"
                            title="Assign an ad in Ad Manager"
                          >
                            <span>No ads configured</span>
                            <span>&rarr;</span>
                          </Link>
                        )}
                      </td>

                      {/* Status Column */}
                      <td style={getColStyle('status')} className="px-5 py-4 whitespace-nowrap overflow-hidden">
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : u.status === 'DISABLED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                          }`}
                          title={`Click to toggle status`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${u.status === 'ACTIVE' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : u.status === 'DISABLED' ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
                          <span>{u.status}</span>
                        </button>
                      </td>

                      {/* Featured Column */}
                      <td style={getColStyle('featured')} className="px-5 py-4 whitespace-nowrap overflow-hidden">
                        <button
                          onClick={() => handleToggleFeatured(u.id, u.isFeatured)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                            u.isFeatured
                              ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                              : 'text-slate-500 hover:text-slate-300 bg-slate-950 border border-slate-800'
                          }`}
                        >
                          <span>{u.isFeatured ? '★' : '☆'}</span>
                          <span>{u.isFeatured ? 'Featured' : 'Standard'}</span>
                        </button>
                      </td>

                      {/* Actions Column (Clean, Spacious Inline Buttons) */}
                      <td style={getColStyle('actions')} className="px-5 py-4 text-right whitespace-nowrap overflow-hidden">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingUtility(u)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 shadow-sm flex items-center gap-1"
                          >
                            <span>✏️</span> Edit
                          </button>
                          <a
                            href={`/${u.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-slate-800 shadow-sm inline-flex items-center gap-1"
                          >
                            <span>↗</span> View
                          </a>
                        </div>
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
