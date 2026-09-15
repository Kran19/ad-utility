'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApiFetch } from '../../../lib/admin-api';
import { PhotoGalleryModal, GalleryPhoto } from '../../../components/admin/PhotoGalleryModal';

const BANNER_SIZES = {
  horizontal: {
    small: { label: 'Small', dimensions: '468 × 60 px', width: 468, height: 60, desc: 'Compact Banner' },
    medium: { label: 'Medium', dimensions: '728 × 90 px', width: 728, height: 90, desc: 'Standard Leaderboard' },
    large: { label: 'Large', dimensions: '970 × 250 px', width: 970, height: 250, desc: 'Large Billboard' },
  },
  vertical: {
    small: { label: 'Small', dimensions: '200 × 200 px', width: 200, height: 200, desc: 'Square / QR' },
    medium: { label: 'Medium', dimensions: '300 × 250 px', width: 300, height: 250, desc: 'Medium Card / Box' },
    large: { label: 'Large', dimensions: '300 × 600 px', width: 300, height: 600, desc: 'Tall Skyscraper' },
  },
};

export default function AdminCreativesPage() {
  const [creatives, setCreatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [newCreative, setNewCreative] = useState({
    name: '',
    type: 'IMAGE',
    mediaUrl: '',
    targetUrl: '',
    width: 728,
    height: 90,
    sizeOrientation: 'horizontal' as 'horizontal' | 'vertical',
    sizePreset: 'medium' as 'small' | 'medium' | 'large',
    altText: '',
    customHtml: '',
    isGlobalFallback: false,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [imageInputMethod, setImageInputMethod] = useState<'upload' | 'url'>('upload');

  const handleSelectFromGallery = (photo: GalleryPhoto) => {
    const isSquareOrVertical = (photo.height || 1) >= (photo.width || 1) * 0.75;
    const autoOrientation = isSquareOrVertical ? 'vertical' : 'horizontal';
    const autoPreset = isSquareOrVertical ? 'small' : 'medium';
    const defaultDimensions = isSquareOrVertical
      ? BANNER_SIZES.vertical.small
      : BANNER_SIZES.horizontal.medium;

    setNewCreative((prev) => ({
      ...prev,
      mediaUrl: photo.mediaUrl,
      name: prev.name || photo.name,
      altText: prev.altText || photo.altText || photo.name,
      targetUrl: prev.targetUrl || photo.targetUrl || 'https://example.com',
      sizeOrientation: autoOrientation,
      sizePreset: autoPreset,
      width: photo.width || defaultDimensions.width,
      height: photo.height || defaultDimensions.height,
    }));
  };

  const handleImageFileSelect = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WebP, SVG, GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit. Please upload an optimized banner image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      const testImg = new window.Image();
      testImg.onload = () => {
        const isSquareOrVertical = testImg.naturalHeight >= testImg.naturalWidth * 0.75;
        const autoOrientation = isSquareOrVertical ? 'vertical' : 'horizontal';
        const autoPreset = isSquareOrVertical ? 'small' : 'medium';
        const defaultDimensions = isSquareOrVertical
          ? BANNER_SIZES.vertical.small
          : BANNER_SIZES.horizontal.medium;

        setNewCreative((prev) => ({
          ...prev,
          mediaUrl: dataUrl,
          name: prev.name || cleanName,
          altText: prev.altText || cleanName,
          sizeOrientation: autoOrientation,
          sizePreset: autoPreset,
          width: defaultDimensions.width,
          height: defaultDimensions.height,
        }));
      };
      testImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

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
        <div className="flex items-center gap-3">
          <Link
            href="/admin/gallery"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 shadow-md transition-colors flex items-center gap-2"
          >
            <span>📸</span> Photo Gallery
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <span>+</span> Upload Creative
          </button>
        </div>
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <h2 className="text-base font-bold text-white">Create New Creative</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>
            <form id="create-creative-form" onSubmit={handleCreate} className="p-5 overflow-y-auto space-y-3.5 flex-1 overscroll-contain">
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
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Banner Image Source</label>
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setImageInputMethod('upload')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          imageInputMethod === 'upload'
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        📁 Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMethod('url')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          imageInputMethod === 'url'
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        🔗 URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGalleryModal(true)}
                        className="px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors font-medium border border-indigo-500/30"
                      >
                        📸 Gallery
                      </button>
                    </div>
                  </div>

                  {imageInputMethod === 'upload' ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleImageFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => {
                        const input = document.getElementById('creative-file-input');
                        if (input) input.click();
                      }}
                      className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                        isDragging
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : newCreative.mediaUrl
                          ? 'border-emerald-500/40 bg-emerald-950/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="file"
                        id="creative-file-input"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleImageFileSelect(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-sm text-indigo-400">
                        {newCreative.mediaUrl ? '✓' : '☁️'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {newCreative.mediaUrl ? 'Click or drag new image to replace' : 'Click to select image or drag & drop here'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP, SVG, GIF (Up to 10MB)</p>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="url"
                      placeholder="https://example.com/banner.png"
                      value={newCreative.mediaUrl}
                      onChange={(e) => setNewCreative({ ...newCreative, mediaUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                    />
                  )}

                  {newCreative.mediaUrl && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 flex flex-col items-center justify-center gap-1.5">
                      <div className="w-full flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800 font-mono">
                        <span className="text-emerald-400 font-semibold">● Preview</span>
                        <button
                          type="button"
                          onClick={() => setNewCreative({ ...newCreative, mediaUrl: '' })}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <img
                        src={newCreative.mediaUrl}
                        alt="Creative preview"
                        className="max-h-24 max-w-full object-contain rounded"
                      />
                    </div>
                  )}
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

              {newCreative.type === 'IMAGE' && (
                <div className="space-y-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">📐 Size & Orientation Presets</label>
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          const dims = BANNER_SIZES.horizontal[newCreative.sizePreset];
                          setNewCreative((prev) => ({
                            ...prev,
                            sizeOrientation: 'horizontal',
                            width: dims.width,
                            height: dims.height,
                          }));
                        }}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          newCreative.sizeOrientation === 'horizontal'
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ↔ Horizontal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const dims = BANNER_SIZES.vertical[newCreative.sizePreset];
                          setNewCreative((prev) => ({
                            ...prev,
                            sizeOrientation: 'vertical',
                            width: dims.width,
                            height: dims.height,
                          }));
                        }}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          newCreative.sizeOrientation === 'vertical'
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ↕ Vertical / Square
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {(['small', 'medium', 'large'] as const).map((key) => {
                      const opt = BANNER_SIZES[newCreative.sizeOrientation][key];
                      const isSelected = newCreative.sizePreset === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setNewCreative((prev) => ({
                              ...prev,
                              sizePreset: key,
                              width: opt.width,
                              height: opt.height,
                            }));
                          }}
                          className={`p-1.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-500/15 text-white ring-1 ring-indigo-500/50'
                              : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                            <span>{opt.label}</span>
                            {isSelected && <span className="text-indigo-400 text-[9px]">✓</span>}
                          </div>
                          <div className="text-[10px] font-mono text-indigo-300">{opt.dimensions}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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

            </form>

            <div className="px-5 py-3.5 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-900">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 text-xs hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-creative-form"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-500/20 transition-colors"
              >
                Save Creative
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Gallery Selector Modal */}
      <PhotoGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
        onSelectPhoto={handleSelectFromGallery}
      />
    </div>
  );
}
