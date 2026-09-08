'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminCreativesPage() {
  const [creatives, setCreatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newCreative, setNewCreative] = useState({
    name: '',
    type: 'IMAGE',
    mediaUrl: '',
    targetUrl: '',
    width: 728,
    height: 90,
    altText: '',
    customHtml: '',
    isGlobalFallback: false,
  });

  const loadCreatives = async () => {
    setLoading(true);
    let path = '/admin/ads/creatives?page=1&pageSize=50';
    if (search) path += `&search=${encodeURIComponent(search)}`;
    if (typeFilter) path += `&type=${encodeURIComponent(typeFilter)}`;

    const res = await adminApiFetch(path);
    if (res.success && res.data) {
      setCreatives(res.data.items || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCreatives();
  }, [search, typeFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminApiFetch('/admin/ads/creatives', {
      method: 'POST',
      body: JSON.stringify({
        ...newCreative,
        width: Number(newCreative.width) || undefined,
        height: Number(newCreative.height) || undefined,
      }),
    });

    if (res.success) {
      setShowModal(false);
      setNewCreative({
        name: '',
        type: 'IMAGE',
        mediaUrl: '',
        targetUrl: '',
        width: 728,
        height: 90,
        altText: '',
        customHtml: '',
        isGlobalFallback: false,
      });
      loadCreatives();
    } else {
      alert(res.error || 'Failed to create creative');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete creative "${name}"?`)) return;
    const res = await adminApiFetch(`/admin/ads/creatives/${id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      loadCreatives();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Creative Asset Gallery</h1>
          <p className="text-xs text-slate-400 mt-1">Manage display banners, videos, HTML snippets, and global fallbacks</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span> Upload Creative
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <input
          type="text"
          placeholder="Search creatives..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Formats</option>
          <option value="IMAGE">Image</option>
          <option value="VIDEO">Video</option>
          <option value="HTML">HTML</option>
          <option value="IFRAME">iFrame</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading creatives...</div>
      ) : creatives.length === 0 ? (
        <div className="py-20 text-center text-xs text-slate-400">No creatives found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creatives.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-mono font-semibold">
                    {c.type}
                  </span>
                  {c.isGlobalFallback && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Global Fallback
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white truncate">{c.name}</h3>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Dimensions: {c.width || 'Auto'} &times; {c.height || 'Auto'}</span>
                </div>
              </div>

              {/* Preview */}
              <div className="h-28 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-center p-2 overflow-hidden text-xs text-slate-500">
                {c.type === 'IMAGE' && c.mediaUrl ? (
                  <img src={c.mediaUrl} alt={c.altText || ''} className="max-h-full max-w-full object-contain rounded" />
                ) : c.type === 'HTML' ? (
                  <div className="text-[10px] text-slate-400 overflow-hidden line-clamp-3 font-mono">{c.customHtml}</div>
                ) : (
                  <span>Preview ({c.type})</span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <a
                  href={c.targetUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline truncate max-w-[180px] text-[11px]"
                >
                  {c.targetUrl || 'No target URL'}
                </a>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="text-rose-400 hover:text-rose-300 text-[11px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Create New Creative</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Creative Name</label>
                <input
                  type="text"
                  required
                  value={newCreative.name}
                  onChange={(e) => setNewCreative({ ...newCreative, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Format</label>
                  <select
                    value={newCreative.type}
                    onChange={(e) => setNewCreative({ ...newCreative, type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  >
                    <option value="IMAGE">IMAGE</option>
                    <option value="VIDEO">VIDEO</option>
                    <option value="HTML">HTML</option>
                    <option value="IFRAME">IFRAME</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Alt Text</label>
                  <input
                    type="text"
                    value={newCreative.altText}
                    onChange={(e) => setNewCreative({ ...newCreative, altText: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              {newCreative.type === 'IMAGE' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300">Media URL (https://...)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/banner.png"
                    value={newCreative.mediaUrl}
                    onChange={(e) => setNewCreative({ ...newCreative, mediaUrl: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              )}

              {newCreative.type === 'HTML' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300">Custom HTML</label>
                  <textarea
                    rows={3}
                    required
                    value={newCreative.customHtml}
                    onChange={(e) => setNewCreative({ ...newCreative, customHtml: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300">Target Landing URL (https://...)</label>
                <input
                  type="url"
                  placeholder="https://example.com/landing"
                  value={newCreative.targetUrl}
                  onChange={(e) => setNewCreative({ ...newCreative, targetUrl: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Width (px)</label>
                  <input
                    type="number"
                    value={newCreative.width}
                    onChange={(e) => setNewCreative({ ...newCreative, width: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Height (px)</label>
                  <input
                    type="number"
                    value={newCreative.height}
                    onChange={(e) => setNewCreative({ ...newCreative, height: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="fallback"
                  checked={newCreative.isGlobalFallback}
                  onChange={(e) => setNewCreative({ ...newCreative, isGlobalFallback: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800"
                />
                <label htmlFor="fallback" className="text-xs text-slate-300">Set as Global Fallback Creative</label>
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
                  Save Creative
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
