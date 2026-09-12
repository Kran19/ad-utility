'use client';

import React, { useState, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import {
  Upload,
  Download,
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
  Check,
  Sliders,
  Crop,
  Maximize2,
  RotateCw,
  Sparkles,
  Layers,
  Move,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';

interface ImageWorkspaceProps {
  utility: UtilityPublicDto;
}

interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({ utility }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [quality, setQuality] = useState<number>(utility.slug === 'image-compressor' ? 70 : 85);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Crop Controls
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, width: 0, height: 0 });
  const [cropCategory, setCropCategory] = useState<'ratio' | 'social' | 'custom'>('ratio');
  const [activePreset, setActivePreset] = useState<string>('full');
  const [rotateDegrees, setRotateDegrees] = useState<number>(0);
  const [targetFormat, setTargetFormat] = useState<string>('image/png');

  // Resizer Controls
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);

  const [resultData, setResultData] = useState<{
    dataUrl: string;
    filename: string;
    sizeBytes: number;
    originalSizeBytes?: number;
    savingsPercent?: number;
    width?: number;
    height?: number;
    pageCount?: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const nw = e.currentTarget.naturalWidth || 800;
    const nh = e.currentTarget.naturalHeight || 600;
    setNaturalDimensions({ width: nw, height: nh });

    // Auto-initialize crop to full image
    setCrop({
      x: 0,
      y: 0,
      width: nw,
      height: nh,
    });
    setActivePreset('full');

    // Auto-initialize resizer
    setTargetWidth(nw);
    setTargetHeight(nh);
  };

  const applyRatioPreset = (presetKey: string, ratioNumerator: number, ratioDenominator: number) => {
    setActivePreset(presetKey);
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    if (nw <= 0 || nh <= 0) return;

    if (presetKey === 'full') {
      setCrop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }

    const targetRatio = ratioNumerator / ratioDenominator;
    let cw = nw;
    let ch = Math.round(nw / targetRatio);

    if (ch > nh) {
      ch = nh;
      cw = Math.round(nh * targetRatio);
    }

    cw = Math.max(1, Math.min(cw, nw));
    ch = Math.max(1, Math.min(ch, nh));
    const cx = Math.max(0, Math.floor((nw - cw) / 2));
    const cy = Math.max(0, Math.floor((nh - ch) / 2));

    setCrop({ x: cx, y: cy, width: cw, height: ch });
  };

  const applyFixedSizePreset = (presetKey: string, targetW: number, targetH: number) => {
    setActivePreset(presetKey);
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    if (nw <= 0 || nh <= 0) return;

    // Scale down if preset exceeds source bounds while maintaining exact ratio
    let cw = targetW;
    let ch = targetH;
    const targetRatio = targetW / targetH;

    if (cw > nw || ch > nh) {
      cw = nw;
      ch = Math.round(nw / targetRatio);
      if (ch > nh) {
        ch = nh;
        cw = Math.round(nh * targetRatio);
      }
    }

    cw = Math.max(1, Math.min(cw, nw));
    ch = Math.max(1, Math.min(ch, nh));
    const cx = Math.max(0, Math.floor((nw - cw) / 2));
    const cy = Math.max(0, Math.floor((nh - ch) / 2));

    setCrop({ x: cx, y: cy, width: cw, height: ch });
  };

  const centerCrop = () => {
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    if (nw <= 0 || nh <= 0) return;
    const cx = Math.max(0, Math.floor((nw - crop.width) / 2));
    const cy = Math.max(0, Math.floor((nh - crop.height) / 2));
    setCrop((prev) => ({ ...prev, x: cx, y: cy }));
  };

  const updateCropCoord = (field: keyof CropState, value: number) => {
    setActivePreset('custom');
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    if (nw <= 0 || nh <= 0) return;

    setCrop((prev) => {
      const next = { ...prev, [field]: value };
      const safeX = Math.max(0, Math.min(next.x, nw - 1));
      const safeY = Math.max(0, Math.min(next.y, nh - 1));
      const safeW = Math.max(1, Math.min(next.width, nw - safeX));
      const safeH = Math.max(1, Math.min(next.height, nh - safeY));
      return { x: safeX, y: safeY, width: safeW, height: safeH };
    });
  };

  const handleResizeScale = (scale: number) => {
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    if (nw <= 0 || nh <= 0) return;
    setTargetWidth(Math.max(1, Math.round(nw * scale)));
    setTargetHeight(Math.max(1, Math.round(nh * scale)));
  };

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setResultData(null);

    // Validate size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 20MB limit. Please select a smaller image.');
      return;
    }

    // Validate MIME
    const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.jpe?g$/i.test(file.name);
    const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
    const isWebp = file.type === 'image/webp' || /\.webp$/i.test(file.name);

    if (utility.slug === 'jpg-to-png' && !isJpg) {
      setErrorMsg('Please select a valid JPG or JPEG image.');
      return;
    }
    if (utility.slug === 'png-to-jpg' && !isPng) {
      setErrorMsg('Please select a valid PNG image.');
      return;
    }
    if (utility.slug === 'webp-to-jpg' && !isWebp) {
      setErrorMsg('Please select a valid WebP image.');
      return;
    }
    if (utility.slug === 'jpg-to-webp' && !isJpg) {
      setErrorMsg('Please select a valid JPG or JPEG image.');
      return;
    }
    if (utility.slug === 'png-to-webp' && !isPng) {
      setErrorMsg('Please select a valid PNG image.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    if (!selectedFile || !filePreview) return;

    setIsLoading(true);
    setErrorMsg(null);
    setResultData(null);

    const startTime = performance.now();
    trackToolStart(utility.slug);

    try {
      const apiUrl = getClientApiUrl();
      const payload: any = {
        fileData: filePreview,
        filename: selectedFile.name,
      };

      if (
        utility.slug === 'png-to-jpg' ||
        utility.slug === 'image-compressor' ||
        utility.slug === 'webp-to-jpg' ||
        utility.slug === 'jpg-to-webp' ||
        utility.slug === 'png-to-webp'
      ) {
        payload.quality = quality;
      }

      if (utility.slug === 'image-cropper') {
        const nw = naturalDimensions.width || 800;
        const nh = naturalDimensions.height || 600;
        const finalW = crop.width > 0 ? crop.width : nw;
        const finalH = crop.height > 0 ? crop.height : nh;
        payload.x = crop.x;
        payload.y = crop.y;
        payload.width = finalW;
        payload.height = finalH;
        payload.rotateDegrees = rotateDegrees;
        payload.format = targetFormat;
        payload.quality = quality;
      }

      if (utility.slug === 'image-resizer') {
        payload.width = targetWidth > 0 ? targetWidth : undefined;
        payload.height = targetHeight > 0 ? targetHeight : undefined;
        payload.maintainAspectRatio = maintainAspectRatio;
        payload.quality = quality;
      }

      if (utility.slug === 'image-to-pdf') {
        payload.images = [filePreview];
        payload.pageSize = 'A4';
        payload.orientation = 'portrait';
        payload.fit = 'contain';
      }

      const res = await fetch(`${apiUrl}/utilities/${utility.slug}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Image processing failed');
      }

      const output = json.data.result;
      setResultData({
        dataUrl: output.dataUrl || output.pdfDataUrl,
        filename: output.filename || 'output-image',
        sizeBytes: output.sizeBytes || output.compressedSizeBytes || output.pdfSizeBytes,
        originalSizeBytes: selectedFile.size,
        savingsPercent: output.savingsPercent,
        width: output.width,
        height: output.height,
        pageCount: output.pageCount,
      });

      const elapsed = Math.round(performance.now() - startTime);
      trackToolComplete(utility.slug, elapsed);
    } catch (err: any) {
      const msg = err.message || 'Failed to process image';
      setErrorMsg(msg);
      trackToolError(utility.slug, msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultData) return;
    trackResultDownload(utility.slug, { filename: resultData.filename, sizeBytes: resultData.sizeBytes });
    const a = document.createElement('a');
    a.href = resultData.dataUrl;
    a.download = resultData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getAcceptedMimes = () => {
    if (utility.slug === 'jpg-to-png' || utility.slug === 'jpg-to-webp') return 'image/jpeg,image/jpg';
    if (utility.slug === 'png-to-jpg' || utility.slug === 'png-to-webp') return 'image/png';
    if (utility.slug === 'webp-to-jpg') return 'image/webp';
    return 'image/jpeg,image/png,image/webp';
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name} Workspace</h2>
            <p className="text-xs text-slate-500">Max file size: 20MB &bull; 100% Secure in-memory processing</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* Upload Drop Zone */}
      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300/80 hover:border-blue-500/80 bg-slate-50/60 hover:bg-blue-50/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptedMimes()}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-blue-600 shadow-xs">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Drag & drop your image here, or <span className="text-blue-600 underline">browse</span>
          </h3>
          <p className="text-xs text-slate-500">
            Supports {getAcceptedMimes().replace(/image\//g, '.').toUpperCase()} up to 20MB
          </p>
        </div>
      ) : (
        /* Selected Image View & Controls */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original File Preview & Live Crop Box */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold uppercase tracking-wider text-slate-700">
                  Source Image ({naturalDimensions.width} &times; {naturalDimensions.height} px)
                </span>
                <span className="font-mono text-slate-500">{formatBytes(selectedFile.size)}</span>
              </div>
              {filePreview && (
                <div className="relative aspect-video max-h-72 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 select-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreview}
                    alt="Selected preview"
                    onLoad={handleImageLoaded}
                    className="max-h-full max-w-full object-contain pointer-events-none"
                  />
                  {utility.slug === 'image-cropper' && crop.width > 0 && naturalDimensions.width > 0 && (
                    <div
                      className="absolute border-2 border-blue-600 bg-blue-500/20 shadow-lg pointer-events-none transition-all duration-150"
                      style={{
                        left: `${(crop.x / naturalDimensions.width) * 100}%`,
                        top: `${(crop.y / naturalDimensions.height) * 100}%`,
                        width: `${(crop.width / naturalDimensions.width) * 100}%`,
                        height: `${(crop.height / naturalDimensions.height) * 100}%`,
                      }}
                    >
                      <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-mono font-bold shadow whitespace-nowrap">
                        {crop.width} &times; {crop.height} px
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span className="truncate max-w-[200px] font-medium text-slate-700" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                    setResultData(null);
                    setNaturalDimensions({ width: 0, height: 0 });
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-lg shadow-xs hover:bg-rose-50 transition-colors"
                >
                  Change Image
                </button>
              </div>
            </div>

            {/* Controls / Result Preview */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between space-y-4">
              {resultData ? (
                /* Result Preview */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> Output Ready
                    </span>
                    <span className="text-slate-600 font-mono font-medium">{formatBytes(resultData.sizeBytes)}</span>
                  </div>
                  <div className="relative aspect-video max-h-72 rounded-xl overflow-hidden bg-white flex items-center justify-center border border-emerald-200 shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultData.dataUrl} alt="Processed output" className="max-h-full max-w-full object-contain" />
                  </div>
                  {resultData.width && resultData.height && (
                    <p className="text-center text-xs text-slate-600 font-mono">
                      Dimensions: {resultData.width} &times; {resultData.height} px
                    </p>
                  )}
                  {typeof resultData.savingsPercent === 'number' && (
                    <div className="text-xs text-center p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                      Saved {resultData.savingsPercent}% in file size!
                    </div>
                  )}
                </div>
              ) : (
                /* Conversion & Tool Options */
                <div className="space-y-4 my-auto">
                  {/* IMAGE CROPPER CONTROLS & PRESETS */}
                  {utility.slug === 'image-cropper' && (
                    <div className="space-y-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                        <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                          <Crop className="w-4 h-4" /> Select Crop Size / Ratio
                        </span>
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200 font-bold">
                          {crop.width} &times; {crop.height} px
                        </span>
                      </div>

                      {/* Preset Category Switcher */}
                      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => setCropCategory('ratio')}
                          className={`py-1.5 px-2 rounded-lg font-bold transition-all ${
                            cropCategory === 'ratio' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Aspect Ratios
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropCategory('social')}
                          className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                            cropCategory === 'social' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" /> Social Sizes
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropCategory('custom')}
                          className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                            cropCategory === 'custom' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5" /> Custom (px)
                        </button>
                      </div>

                      {/* 1. Aspect Ratio Presets */}
                      {cropCategory === 'ratio' && (
                        <div className="grid grid-cols-4 gap-1.5 text-xs">
                          {[
                            { key: 'full', label: 'Full', n: 1, d: 1 },
                            { key: '1:1', label: '1:1 Square', n: 1, d: 1 },
                            { key: '4:3', label: '4:3 Standard', n: 4, d: 3 },
                            { key: '16:9', label: '16:9 Wide', n: 16, d: 9 },
                            { key: '9:16', label: '9:16 Story', n: 9, d: 16 },
                            { key: '3:2', label: '3:2 Classic', n: 3, d: 2 },
                            { key: '2:3', label: '2:3 Portrait', n: 2, d: 3 },
                            { key: 'custom', label: 'Free', n: 1, d: 1 },
                          ].map((p) => (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => applyRatioPreset(p.key, p.n, p.d)}
                              className={`py-1.5 px-2 rounded-xl font-bold text-xs transition-colors ${
                                activePreset === p.key
                                  ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 2. Social & Digital Media Size Presets */}
                      {cropCategory === 'social' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                          {[
                            { key: 'ig_post', label: 'Instagram (1080×1080)', w: 1080, h: 1080 },
                            { key: 'ig_story', label: 'Story/Reels (1080×1920)', w: 1080, h: 1920 },
                            { key: 'yt_thumb', label: 'YouTube (1280×720)', w: 1280, h: 720 },
                            { key: 'fb_cover', label: 'FB Cover (820×312)', w: 820, h: 312 },
                            { key: 'x_header', label: 'X Header (1500×500)', w: 1500, h: 500 },
                            { key: 'id_photo', label: 'Avatar / ID (600×600)', w: 600, h: 600 },
                          ].map((p) => (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => applyFixedSizePreset(p.key, p.w, p.h)}
                              className={`py-1.5 px-2 rounded-xl font-bold text-left text-[11px] transition-colors truncate ${
                                activePreset === p.key
                                  ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Manual Dimension Inputs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">X Offset (px)</label>
                          <input
                            type="number"
                            min="0"
                            max={naturalDimensions.width}
                            value={crop.x}
                            onChange={(e) => updateCropCoord('x', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Y Offset (px)</label>
                          <input
                            type="number"
                            min="0"
                            max={naturalDimensions.height}
                            value={crop.y}
                            onChange={(e) => updateCropCoord('y', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-blue-700 block mb-1 uppercase">Width (px)</label>
                          <input
                            type="number"
                            min="1"
                            max={naturalDimensions.width}
                            value={crop.width}
                            onChange={(e) => updateCropCoord('width', parseInt(e.target.value, 10) || 1)}
                            className="w-full bg-white border-2 border-blue-500 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-blue-700 block mb-1 uppercase">Height (px)</label>
                          <input
                            type="number"
                            min="1"
                            max={naturalDimensions.height}
                            value={crop.height}
                            onChange={(e) => updateCropCoord('height', parseInt(e.target.value, 10) || 1)}
                            className="w-full bg-white border-2 border-blue-500 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>

                      {/* Quick Actions & Format */}
                      <div className="flex flex-wrap items-center justify-between pt-1 gap-2 text-xs border-t border-slate-100">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={centerCrop}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                          >
                            Center Selection
                          </button>
                          <button
                            type="button"
                            onClick={() => applyRatioPreset('full', 1, 1)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                          >
                            Reset Full
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px] font-semibold">Format:</span>
                          <select
                            value={targetFormat}
                            onChange={(e) => setTargetFormat(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-slate-900 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="image/png">PNG</option>
                            <option value="image/jpeg">JPG</option>
                            <option value="image/webp">WebP</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image Resizer Controls */}
                  {utility.slug === 'image-resizer' && (
                    <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                        <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                          <Maximize2 className="w-4 h-4" /> Target Resolution
                        </span>
                        <span className="font-mono text-slate-600 font-bold">
                          {targetWidth} &times; {targetHeight} px
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-xs">
                        {[
                          { scale: 0.25, label: '25%' },
                          { scale: 0.5, label: '50%' },
                          { scale: 0.75, label: '75%' },
                          { scale: 1.0, label: '100%' },
                        ].map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => handleResizeScale(s.scale)}
                            className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Width (px)</label>
                          <input
                            type="number"
                            min="1"
                            value={targetWidth}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setTargetWidth(val);
                              if (maintainAspectRatio && naturalDimensions.width > 0) {
                                setTargetHeight(Math.round(val * (naturalDimensions.height / naturalDimensions.width)));
                              }
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Height (px)</label>
                          <input
                            type="number"
                            min="1"
                            value={targetHeight}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setTargetHeight(val);
                              if (maintainAspectRatio && naturalDimensions.height > 0) {
                                setTargetWidth(Math.round(val * (naturalDimensions.width / naturalDimensions.height)));
                              }
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={maintainAspectRatio}
                          onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 accent-blue-600"
                        />
                        Lock Aspect Ratio
                      </label>
                    </div>
                  )}

                  {/* Quality Slider for Compression & Conversion */}
                  {(utility.slug === 'png-to-jpg' ||
                    utility.slug === 'image-compressor' ||
                    utility.slug === 'webp-to-jpg' ||
                    utility.slug === 'jpg-to-webp' ||
                    utility.slug === 'png-to-webp') && (
                    <div className="space-y-2 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-bold flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-blue-600" /> Output Quality
                        </span>
                        <span className="text-blue-700 font-bold font-mono">{quality}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={quality}
                        onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Compact (10%)</span>
                        <span>Balanced (70%)</span>
                        <span>Maximum (100%)</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 space-y-1.5 leading-relaxed bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <p className="font-bold text-slate-700">Execution Features:</p>
                    <ul className="list-disc list-inside text-slate-500 space-y-1 text-[11px]">
                      <li>Authoritative magic byte format verification</li>
                      {utility.slug === 'image-cropper' && <li>Custom pixel sizes and social media ratio presets</li>}
                      {utility.slug === 'image-resizer' && <li>High-quality Lanczos/Bicubic resampling algorithm</li>}
                      {utility.slug === 'png-to-jpg' && <li>Solid white alpha channel background blending</li>}
                      {utility.slug === 'jpg-to-webp' && <li>Modern WebP compression with ~30% smaller footprint</li>}
                      <li>Fast in-memory processing without server storage</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                {resultData ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setResultData(null);
                      }}
                      className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700 transition-colors"
                    >
                      Re-adjust
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleProcess}
                    disabled={isLoading}
                    className="w-full px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Run {utility.name}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-800">Processing Error</p>
            <p className="text-rose-700 text-xs mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
