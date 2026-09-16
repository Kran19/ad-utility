'use client';

import React, { useState, useEffect, useRef } from 'react';
import { adminApiFetch } from '../../lib/admin-api';
import { normalizeMediaUrl } from '../../lib/site-config';

export interface GalleryPhoto {
  id: string;
  name: string;
  type: string;
  mediaUrl: string;
  targetUrl?: string;
  width?: number;
  height?: number;
  altText?: string;
  createdAt?: string;
  targetingRulesCount?: number;
}

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto: (photo: GalleryPhoto) => void;
  selectedPhotoId?: string;
  title?: string;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  isOpen,
  onClose,
  onSelectPhoto,
  selectedPhotoId,
  title = 'Select Photo from Gallery',
}) => {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orientationFilter, setOrientationFilter] = useState<'ALL' | 'HORIZONTAL' | 'VERTICAL' | 'SQUARE'>('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadGalleryPhotos = async () => {
    setLoading(true);
    try {
      const res = await adminApiFetch('/admin/ads/creatives?type=IMAGE&pageSize=100');
      if (res.success && res.data?.items) {
        const imageItems: GalleryPhoto[] = res.data.items
          .filter((item: any) => item.type === 'IMAGE' && item.mediaUrl)
          .map((item: any) => ({
            id: item.id,
            name: item.name || 'Untitled Image',
            type: item.type,
            mediaUrl: normalizeMediaUrl(item.mediaUrl) || item.mediaUrl,
            targetUrl: item.targetUrl,
            width: item.width,
            height: item.height,
            altText: item.altText,
            createdAt: item.createdAt,
            targetingRulesCount: item._count?.targetingRules || 0,
          }));
        setPhotos(imageItems);
      }
    } catch {
      // Fail-open
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGalleryPhotos();
    }
  }, [isOpen]);

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WebP, SVG, GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image exceeds 10MB limit. Please choose an optimized image.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      const img = new window.Image();
      img.onload = async () => {
        const width = img.naturalWidth || 728;
        const height = img.naturalHeight || 90;

        try {
          const res = await adminApiFetch('/admin/ads/creatives', {
            method: 'POST',
            body: JSON.stringify({
              name: cleanName,
              type: 'IMAGE',
              mediaUrl: dataUrl,
              targetUrl: 'https://example.com',
              width,
              height,
              altText: cleanName,
            }),
          });

          if (res.success && res.data) {
            const newPhoto: GalleryPhoto = {
              id: res.data.id,
              name: res.data.name || cleanName,
              type: 'IMAGE',
              mediaUrl: res.data.mediaUrl || dataUrl,
              targetUrl: res.data.targetUrl,
              width: res.data.width || width,
              height: res.data.height || height,
              altText: res.data.altText || cleanName,
              createdAt: new Date().toISOString(),
            };
            setPhotos((prev) => [newPhoto, ...prev]);
            onSelectPhoto(newPhoto);
            onClose();
          } else {
            setUploadError(res.error || 'Failed to upload image to gallery');
          }
        } catch (err: any) {
          setUploadError(err.message || 'Error uploading image');
        } finally {
          setIsUploading(false);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const filteredPhotos = photos.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.altText?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (orientationFilter === 'ALL') return true;
    const w = p.width || 1;
    const h = p.height || 1;
    const ratio = w / h;

    if (orientationFilter === 'HORIZONTAL') return ratio >= 1.3;
    if (orientationFilter === 'VERTICAL') return ratio <= 0.77;
    if (orientationFilter === 'SQUARE') return ratio > 0.77 && ratio < 1.3;

    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl">
              📸
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-xs text-slate-400">
                Browse, upload and choose creative photos for tool ads & placements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Search, Filters & Upload */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-2.5 text-xs text-slate-500">🔍</span>
              <input
                type="text"
                placeholder="Search photo gallery..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs">
              {(['ALL', 'HORIZONTAL', 'SQUARE', 'VERTICAL'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setOrientationFilter(mode)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    orientationFilter === mode
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode === 'ALL' ? 'All' : mode === 'HORIZONTAL' ? 'Horizontal' : mode === 'SQUARE' ? 'Square' : 'Vertical'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files || [])}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <span>{isUploading ? '⏳' : '📤'}</span>
              <span>{isUploading ? 'Uploading Image...' : 'Upload New Photo'}</span>
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mx-4 mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center justify-between">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-rose-400 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Modal Body: Photos Grid & Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
          }}
          className={`flex-1 overflow-y-auto p-4 sm:p-6 transition-colors ${
            isDragging ? 'bg-indigo-950/20 border-2 border-dashed border-indigo-500' : ''
          }`}
        >
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
              Loading photo gallery assets...
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="py-16 text-center space-y-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <div className="text-4xl">📸</div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">No Photos Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {search
                    ? 'No photos match your search criteria. Try a different search query.'
                    : 'Upload your first ad creative photo or drag and drop images directly here.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Browse Images from Device
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredPhotos.map((photo) => {
                const isSelected = selectedPhotoId === photo.id;
                return (
                  <div
                    key={photo.id}
                    onClick={() => {
                      onSelectPhoto(photo);
                      onClose();
                    }}
                    className={`group relative bg-slate-950 rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 flex flex-col hover:shadow-lg hover:border-indigo-500/80 ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-indigo-500/20'
                        : 'border-slate-800/80 hover:bg-slate-900'
                    }`}
                  >
                    {/* Image Preview Thumbnail */}
                    <div className="h-32 bg-slate-900/90 relative flex items-center justify-center overflow-hidden p-2">
                      <img
                        src={photo.mediaUrl}
                        alt={photo.altText || photo.name}
                        className="max-h-full max-w-full object-contain rounded transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Dimensions Tag */}
                      <span className="absolute bottom-2 left-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-slate-300 border border-slate-700/60 font-semibold shadow-xs">
                        {photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'Image'}
                      </span>

                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-md font-bold">
                          ✓
                        </div>
                      )}
                    </div>

                    {/* Image Details Footer */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between border-t border-slate-800/60 bg-slate-900/40">
                      <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-400 transition-colors" title={photo.name}>
                        {photo.name}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Click to Select</span>
                        <span className="text-indigo-400 font-medium group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{filteredPhotos.length}</strong> photo assets
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
