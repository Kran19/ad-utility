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
  const [cropPreset, setCropPreset] = useState<'full' | '1:1' | '4:3' | '16:9' | '3:2' | 'custom'>('full');
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
    setCropPreset('full');

    // Auto-initialize resizer
    setTargetWidth(nw);
    setTargetHeight(nh);
  };

  const applyCropPreset = (preset: 'full' | '1:1' | '4:3' | '16:9' | '3:2' | 'custom') => {
    setCropPreset(preset);
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    if (nw <= 0 || nh <= 0) return;

    if (preset === 'full' || preset === 'custom') {
      setCrop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }

    let targetRatio = 1;
    if (preset === '1:1') targetRatio = 1;
    if (preset === '4:3') targetRatio = 4 / 3;
    if (preset === '16:9') targetRatio = 16 / 9;
    if (preset === '3:2') targetRatio = 3 / 2;

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

    setCrop({
      x: cx,
      y: cy,
      width: cw,
      height: ch,
    });
  };

  const updateCropCoord = (field: keyof CropState, value: number) => {
    setCropPreset('custom');
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

      if (utility.slug === 'png-to-jpg' || utility.slug === 'image-compressor' || utility.slug === 'webp-to-jpg' || utility.slug === 'jpg-to-webp' || utility.slug === 'png-to-webp') {
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
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{utility.name} Workspace</h2>
            <p className="text-xs text-gray-400">Max file size: 20MB &bull; 100% Secure in-memory processing</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800/60 uppercase">
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
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-950/20'
              : 'border-gray-800 hover:border-gray-700 bg-gray-950/50 hover:bg-gray-950'
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
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-blue-400">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-gray-200 mb-1">
            Drag & drop your image here, or <span className="text-blue-400 underline">browse</span>
          </h3>
          <p className="text-xs text-gray-500">
            Supports {getAcceptedMimes().replace(/image\//g, '.').toUpperCase()} up to 20MB
          </p>
        </div>
      ) : (
        /* Selected Image View & Controls */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original File Preview & Crop Box */}
            <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-semibold uppercase text-gray-300">
                  Source Image ({naturalDimensions.width} &times; {naturalDimensions.height} px)
                </span>
                <span>{formatBytes(selectedFile.size)}</span>
              </div>
              {filePreview && (
                <div className="relative aspect-video max-h-64 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center border border-gray-800/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreview}
                    alt="Selected preview"
                    onLoad={handleImageLoaded}
                    className="max-h-full max-w-full object-contain"
                  />
                  {utility.slug === 'image-cropper' && crop.width > 0 && naturalDimensions.width > 0 && (
                    <div
                      className="absolute border-2 border-dashed border-blue-400 bg-blue-500/15 pointer-events-none transition-all"
                      style={{
                        left: `${(crop.x / naturalDimensions.width) * 100}%`,
                        top: `${(crop.y / naturalDimensions.height) * 100}%`,
                        width: `${(crop.width / naturalDimensions.width) * 100}%`,
                        height: `${(crop.height / naturalDimensions.height) * 100}%`,
                      }}
                    >
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-blue-900/90 text-blue-200 text-[10px] font-mono font-bold">
                        {crop.width} &times; {crop.height}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                <span className="truncate max-w-[200px]" title={selectedFile.name}>
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
                  className="text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Change Image
                </button>
              </div>
            </div>

            {/* Controls / Result Preview */}
            <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 flex flex-col justify-between space-y-4">
              {resultData ? (
                /* Result Preview */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Output Ready
                    </span>
                    <span className="text-gray-300 font-mono">{formatBytes(resultData.sizeBytes)}</span>
                  </div>
                  <div className="relative aspect-video max-h-64 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center border border-emerald-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultData.dataUrl} alt="Processed output" className="max-h-full max-w-full object-contain" />
                  </div>
                  {resultData.width && resultData.height && (
                    <p className="text-center text-xs text-gray-400 font-mono">
                      Dimensions: {resultData.width} &times; {resultData.height} px
                    </p>
                  )}
                  {typeof resultData.savingsPercent === 'number' && (
                    <div className="text-xs text-center p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-medium">
                      Saved {resultData.savingsPercent}% in file size!
                    </div>
                  )}
                </div>
              ) : (
                /* Conversion & Tool Options */
                <div className="space-y-4 my-auto">
                  {/* Image Cropper Controls */}
                  {utility.slug === 'image-cropper' && (
                    <div className="space-y-3 p-3.5 rounded-lg bg-gray-900/60 border border-gray-800">
                      <div className="flex items-center justify-between text-xs text-gray-300 font-medium">
                        <span className="flex items-center gap-1.5 text-blue-400">
                          <Crop className="w-3.5 h-3.5" /> Aspect Ratio Preset
                        </span>
                        <span className="font-mono text-gray-400">
                          {crop.width} &times; {crop.height} px
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-xs">
                        {[
                          { key: 'full', label: 'Full Image' },
                          { key: '1:1', label: '1:1 Square' },
                          { key: '4:3', label: '4:3 Standard' },
                          { key: '16:9', label: '16:9 Wide' },
                          { key: '3:2', label: '3:2 Classic' },
                          { key: 'custom', label: 'Free / Custom' },
                        ].map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => applyCropPreset(p.key as any)}
                            className={`py-1.5 px-2 rounded font-medium text-xs transition-colors ${
                              cropPreset === p.key
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">X Offset</label>
                          <input
                            type="number"
                            min="0"
                            max={naturalDimensions.width}
                            value={crop.x}
                            onChange={(e) => updateCropCoord('x', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Y Offset</label>
                          <input
                            type="number"
                            min="0"
                            max={naturalDimensions.height}
                            value={crop.y}
                            onChange={(e) => updateCropCoord('y', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Width (px)</label>
                          <input
                            type="number"
                            min="1"
                            max={naturalDimensions.width}
                            value={crop.width}
                            onChange={(e) => updateCropCoord('width', parseInt(e.target.value, 10) || 1)}
                            className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Height (px)</label>
                          <input
                            type="number"
                            min="1"
                            max={naturalDimensions.height}
                            value={crop.height}
                            onChange={(e) => updateCropCoord('height', parseInt(e.target.value, 10) || 1)}
                            className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-white font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-400">Rotation:</span>
                          <select
                            value={rotateDegrees}
                            onChange={(e) => setRotateDegrees(parseInt(e.target.value, 10))}
                            className="bg-gray-950 border border-gray-800 rounded px-2 py-0.5 text-white text-xs"
                          >
                            <option value="0">0&deg; (None)</option>
                            <option value="90">90&deg; Clockwise</option>
                            <option value="180">180&deg; Invert</option>
                            <option value="270">270&deg; Counter-Clockwise</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Output:</span>
                          <select
                            value={targetFormat}
                            onChange={(e) => setTargetFormat(e.target.value)}
                            className="bg-gray-950 border border-gray-800 rounded px-2 py-0.5 text-white text-xs"
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
                    <div className="space-y-3 p-3.5 rounded-lg bg-gray-900/60 border border-gray-800">
                      <div className="flex items-center justify-between text-xs text-gray-300 font-medium">
                        <span className="flex items-center gap-1.5 text-blue-400">
                          <Maximize2 className="w-3.5 h-3.5" /> Target Resolution
                        </span>
                        <span className="font-mono text-gray-400">
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
                            className="py-1.5 px-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-xs transition-colors"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Width (px)</label>
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
                            className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Height (px)</label>
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
                            className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-white font-mono text-xs"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={maintainAspectRatio}
                          onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                          className="rounded bg-gray-950 border-gray-800 text-blue-500 accent-blue-500"
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
                    <div className="space-y-2 p-3 rounded-lg bg-gray-900/60 border border-gray-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-medium flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-blue-400" /> Output Quality
                        </span>
                        <span className="text-blue-400 font-bold font-mono">{quality}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={quality}
                        onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Compact (10%)</span>
                        <span>Balanced (70%)</span>
                        <span>Maximum (100%)</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 space-y-1.5 leading-relaxed">
                    <p className="font-medium text-gray-300">Execution Features:</p>
                    <ul className="list-disc list-inside text-gray-400 space-y-1">
                      <li>Authoritative magic byte format verification</li>
                      {utility.slug === 'image-cropper' && <li>Lossless & subpixel-accurate coordinate cropping</li>}
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
                      className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-300 transition-colors"
                    >
                      Re-adjust
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleProcess}
                    disabled={isLoading}
                    className="w-full px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
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
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Processing Error</p>
            <p className="text-red-200 text-xs mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
