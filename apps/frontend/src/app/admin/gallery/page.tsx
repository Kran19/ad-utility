'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApiFetch } from '../../../lib/admin-api';
import { useResizableColumns, ResizableTh } from '../../../components/admin/ResizableTable';

interface GalleryItem {
  id: string;
  name: string;
  type: string;
  mediaUrl: string;
  targetUrl?: string;
  width?: number;
  height?: number;
  altText?: string;
  createdAt: string;
  targetingRules?: any[];
  _count?: {
    targetingRules: number;
    impressions: number;
    clicks: number;
  };
}

export default function AdminGalleryPage() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orientationFilter, setOrientationFilter] = useState<'ALL' | 'HORIZONTAL' | 'VERTICAL' | 'SQUARE'>('ALL');
  const [usageFilter, setUsageFilter] = useState<'ALL' | 'IN_USE' | 'UNUSED'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { widths, activeColumn, handleMouseDown, resetColumnWidth, resetAllWidths, getColStyle } =
    useResizableColumns('admin_gallery_table', {
      preview: 120,
      title: 250,
      dimensions: 150,
      usage: 140,
      uploaded: 130,
      actions: 160,
    });

  // Multi-upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<Array<{ file: File; preview: string; name: string; width: number; height: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inspector / Lightbox Modal State
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingAlt, setEditingAlt] = useState('');
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadGallery = async () => {
    setLoading(true);
    try {
      const res = await adminApiFetch('/admin/ads/creatives?type=IMAGE&pageSize=100');
      if (res.success && res.data?.items) {
        const imageItems: GalleryItem[] = res.data.items.filter(
          (i: any) => i.type === 'IMAGE' && i.mediaUrl
        );
        setItems(imageItems);
      }
    } catch {
      // Fail-open
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  // Handle file selection for upload
  const handleFilesSelected = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const newUploadList: Array<{ file: File; preview: string; name: string; width: number; height: number }> = [];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 10 * 1024 * 1024) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const img = new window.Image();
        img.onload = () => {
          setUploadFiles((prev) => [
            ...prev,
            {
              file,
              preview: dataUrl,
              name: cleanName,
              width: img.naturalWidth || 728,
              height: img.naturalHeight || 90,
            },
          ]);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

    setShowUploadModal(true);
  };

  const handleExecuteUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      for (const item of uploadFiles) {
        await adminApiFetch('/admin/ads/creatives', {
          method: 'POST',
          body: JSON.stringify({
            name: item.name,
            type: 'IMAGE',
            mediaUrl: item.preview,
            targetUrl: 'https://example.com',
            width: item.width,
            height: item.height,
            altText: item.name,
          }),
        });
      }

      setUploadFiles([]);
      setShowUploadModal(false);
      showToast(`Successfully uploaded ${uploadFiles.length} photo(s) to gallery!`);
      await loadGallery();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload one or more photos');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete photo "${name}" from the gallery?`)) return;
    try {
      const res = await adminApiFetch(`/admin/ads/creatives/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast(`Photo "${name}" deleted.`);
        if (selectedItem?.id === id) setSelectedItem(null);
        await loadGallery();
      }
    } catch {
      showToast('Failed to delete photo.');
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedItem) return;
    setSavingMetadata(true);
    try {
      const res = await adminApiFetch(`/admin/ads/creatives/${selectedItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editingTitle || selectedItem.name,
          altText: editingAlt || selectedItem.altText,
        }),
      });
      if (res.success) {
        showToast('Photo details updated!');
        setSelectedItem((prev) => prev ? { ...prev, name: editingTitle || prev.name, altText: editingAlt || prev.altText } : null);
        await loadGallery();
      }
    } catch {
      showToast('Failed to update photo details.');
    } finally {
      setSavingMetadata(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  // Filter and stats calculations
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.altText?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    const w = item.width || 1;
    const h = item.height || 1;
    const ratio = w / h;

    if (orientationFilter === 'HORIZONTAL' && ratio < 1.3) return false;
    if (orientationFilter === 'VERTICAL' && ratio > 0.77) return false;
    if (orientationFilter === 'SQUARE' && (ratio <= 0.77 || ratio >= 1.3)) return false;

    const ruleCount = item._count?.targetingRules || item.targetingRules?.length || 0;
    if (usageFilter === 'IN_USE' && ruleCount === 0) return false;
    if (usageFilter === 'UNUSED' && ruleCount > 0) return false;

    return true;
  });

  const totalPhotos = items.length;
  const inUseCount = items.filter((i) => (i._count?.targetingRules || 0) > 0).length;
  const horizontalCount = items.filter((i) => (i.width || 1) / (i.height || 1) >= 1.3).length;
  const verticalSquareCount = totalPhotos - horizontalCount;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-2xl animate-bounce flex items-center gap-2">
          <span>✨</span> {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📸</span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Photo & Creative Gallery</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Centralized photo asset library for display ads, banners, promotions & tool placement targeting
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files || [])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-2"
          >
            <span>+</span> Upload Photos
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Photos</span>
          <div className="text-2xl font-black text-white">{totalPhotos}</div>
          <span className="text-[10px] text-slate-500">Assets in Library</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Active in Ads</span>
          <div className="text-2xl font-black text-emerald-400">{inUseCount}</div>
          <span className="text-[10px] text-slate-500">Live Campaign Rules</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Horizontal Banners</span>
          <div className="text-2xl font-black text-indigo-400">{horizontalCount}</div>
          <span className="text-[10px] text-slate-500">Leaderboards & Headers</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Square / Vertical</span>
          <div className="text-2xl font-black text-purple-400">{verticalSquareCount}</div>
          <span className="text-[10px] text-slate-500">Cards, Boxes & Sticky</span>
        </div>
      </div>

      {/* Drag & Drop Quick Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'bg-indigo-950/30 border-indigo-500 ring-4 ring-indigo-500/20'
            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-2xl text-indigo-400">
            📸
          </div>
          <h3 className="text-sm font-bold text-white">Drag & drop photos or click to browse</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Upload banner graphics, product photos, promotional images (PNG, JPG, WebP, SVG, GIF up to 10MB each).
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500">🔍</span>
            <input
              type="text"
              placeholder="Search by photo title or alt text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Orientation Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs">
            {(['ALL', 'HORIZONTAL', 'SQUARE', 'VERTICAL'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setOrientationFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  orientationFilter === mode
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'ALL' ? 'All Formats' : mode === 'HORIZONTAL' ? 'Horizontal' : mode === 'SQUARE' ? 'Square' : 'Vertical'}
              </button>
            ))}
          </div>

          {/* Usage Filter */}
          <select
            value={usageFilter}
            onChange={(e: any) => setUsageFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Usage</option>
            <option value="IN_USE">Active in Ads Only</option>
            <option value="UNUSED">Unassigned Only</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="Grid View"
          >
            🔲
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="List View"
          >
            📋
          </button>
        </div>
      </div>

      {/* Main Gallery Display */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading photo gallery assets...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
          <div className="text-4xl">📸</div>
          <h3 className="text-sm font-bold text-white">No Photos Matching Filter</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search
              ? `No photo assets found matching "${search}".`
              : 'Your photo gallery is currently empty. Upload photos to easily attach them when configuring ads.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredItems.map((item) => {
            const ruleCount = item._count?.targetingRules || item.targetingRules?.length || 0;
            return (
              <div
                key={item.id}
                className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
              >
                {/* Image Preview Thumbnail */}
                <div
                  onClick={() => {
                    setSelectedItem(item);
                    setEditingTitle(item.name);
                    setEditingAlt(item.altText || '');
                  }}
                  className="h-44 bg-slate-950 relative flex items-center justify-center p-3 cursor-pointer overflow-hidden border-b border-slate-800/80"
                >
                  <img
                    src={item.mediaUrl}
                    alt={item.altText || item.name}
                    className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Dimensions Pill */}
                  <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-xs text-slate-200 border border-slate-700/60 shadow-xs">
                    {item.width && item.height ? `${item.width} × ${item.height}` : 'Image'}
                  </span>

                  {/* Ad Usage Tag */}
                  {ruleCount > 0 ? (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-800 shadow-xs">
                      {ruleCount} Active Ad{ruleCount > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="absolute top-2 right-2 text-[9px] font-medium px-2 py-0.5 rounded-md bg-slate-900/80 text-slate-400 border border-slate-800">
                      Unassigned
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3
                      onClick={() => {
                        setSelectedItem(item);
                        setEditingTitle(item.name);
                        setEditingAlt(item.altText || '');
                      }}
                      className="text-xs font-bold text-white hover:text-indigo-400 transition-colors cursor-pointer truncate"
                      title={item.name}
                    >
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5" title={item.altText || item.name}>
                      {item.altText || 'No description'}
                    </p>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <Link
                      href={`/admin/ad-manager?creativeId=${item.id}`}
                      className="flex-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold border border-indigo-500/30 transition-all text-center flex items-center justify-center gap-1"
                    >
                      <span>🎯</span> Use in Ad
                    </Link>

                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setEditingTitle(item.name);
                        setEditingAlt(item.altText || '');
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                      title="Inspect / Edit"
                    >
                      🔍
                    </button>

                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg text-xs transition-colors"
                      title="Delete Photo"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 table-fixed">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <ResizableTh
                    colKey="preview"
                    width={widths.preview}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'preview'}
                    className="px-4 py-3"
                  >
                    Photo Preview
                  </ResizableTh>
                  <ResizableTh
                    colKey="title"
                    width={widths.title}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'title'}
                    className="px-4 py-3"
                  >
                    Title & Alt
                  </ResizableTh>
                  <ResizableTh
                    colKey="dimensions"
                    width={widths.dimensions}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'dimensions'}
                    className="px-4 py-3"
                  >
                    Dimensions
                  </ResizableTh>
                  <ResizableTh
                    colKey="usage"
                    width={widths.usage}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'usage'}
                    className="px-4 py-3"
                  >
                    Usage
                  </ResizableTh>
                  <ResizableTh
                    colKey="uploaded"
                    width={widths.uploaded}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'uploaded'}
                    className="px-4 py-3"
                  >
                    Uploaded
                  </ResizableTh>
                  <ResizableTh
                    colKey="actions"
                    width={widths.actions}
                    onResizeStart={handleMouseDown}
                    onDoubleClickResize={resetColumnWidth}
                    isActive={activeColumn === 'actions'}
                    className="px-4 py-3 text-right"
                  >
                    Actions
                  </ResizableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredItems.map((item) => {
                  const ruleCount = item._count?.targetingRules || item.targetingRules?.length || 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td style={getColStyle('preview')} className="px-4 py-3 overflow-hidden">
                        <div
                          onClick={() => {
                            setSelectedItem(item);
                            setEditingTitle(item.name);
                            setEditingAlt(item.altText || '');
                          }}
                          className="w-20 h-12 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden cursor-pointer p-1"
                        >
                          <img src={item.mediaUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                        </div>
                      </td>
                      <td style={getColStyle('title')} className="px-4 py-3 overflow-hidden">
                        <div className="font-bold text-white font-sans text-xs truncate" title={item.name}>{item.name}</div>
                        <div className="text-slate-400 text-[10px] font-sans truncate max-w-xs">{item.altText || '—'}</div>
                      </td>
                      <td style={getColStyle('dimensions')} className="px-4 py-3 text-indigo-300 overflow-hidden">
                        {item.width && item.height ? `${item.width} × ${item.height} px` : '—'}
                      </td>
                      <td style={getColStyle('usage')} className="px-4 py-3 overflow-hidden">
                        {ruleCount > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {ruleCount} Ads Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-800 border border-slate-700">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td style={getColStyle('uploaded')} className="px-4 py-3 text-slate-400 text-[10px] overflow-hidden">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td style={getColStyle('actions')} className="px-4 py-3 text-right space-x-2 whitespace-nowrap overflow-hidden">
                        <Link
                          href={`/admin/ad-manager?creativeId=${item.id}`}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-sans font-semibold inline-flex items-center gap-1"
                        >
                          Use in Ad
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1 hover:text-rose-400 text-slate-400 transition-colors"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Multi-Photo Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📤</span>
                <div>
                  <h3 className="text-base font-bold text-white">Upload Photos to Gallery</h3>
                  <p className="text-xs text-slate-400">Review selected photo assets before adding them to the library</p>
                </div>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {uploadError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                  {uploadError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {uploadFiles.map((f, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex gap-3 items-center">
                    <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-slate-800">
                      <img src={f.preview} alt={f.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUploadFiles((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                          );
                        }}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                        placeholder="Image title"
                      />
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                        <span>{f.width} × {f.height} px</span>
                        <span>•</span>
                        <span>{(f.file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Ready to upload <strong className="text-white">{uploadFiles.length}</strong> photo(s)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploading || uploadFiles.length === 0}
                  onClick={handleExecuteUpload}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center gap-2"
                >
                  <span>{uploading ? '⏳' : '✓'}</span>
                  <span>{uploading ? 'Uploading...' : 'Save to Gallery'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Inspector Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="text-sm font-bold text-white truncate max-w-md">{selectedItem.name}</h3>
              <button onClick={() => setSelectedItem(null)} className="p-1 text-slate-400 hover:text-white rounded-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
              {/* Full Image Preview Area */}
              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 flex items-center justify-center min-h-[300px] overflow-hidden">
                <img
                  src={selectedItem.mediaUrl}
                  alt={selectedItem.altText || selectedItem.name}
                  className="max-h-[400px] max-w-full object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Sidebar Details & Actions */}
              <div className="w-full lg:w-80 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Photo Title</label>
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Alt Text / Description</label>
                    <input
                      type="text"
                      value={editingAlt}
                      onChange={(e) => setEditingAlt(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Dimensions:</span>
                      <strong className="text-white font-mono">{selectedItem.width} × {selectedItem.height} px</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Ad Placement:</span>
                      <strong className="text-indigo-400">
                        {(selectedItem._count?.targetingRules || 0) > 0
                          ? `${selectedItem._count?.targetingRules} Active Rules`
                          : 'Available'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Uploaded Date:</span>
                      <span className="text-slate-300">{new Date(selectedItem.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={savingMetadata}
                    onClick={handleSaveMetadata}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                  >
                    {savingMetadata ? 'Saving Changes...' : 'Save Title & Details'}
                  </button>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800">
                  <Link
                    href={`/admin/ad-manager?creativeId=${selectedItem.id}`}
                    onClick={() => setSelectedItem(null)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🎯</span> Use this Photo in Ad
                  </Link>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedItem.mediaUrl, 'Photo URL')}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl text-xs border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>📋</span> Copy Image URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
