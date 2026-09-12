'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import {
  FileText,
  Upload,
  Download,
  RefreshCw,
  AlertCircle,
  Trash2,
  Plus,
  Check,
  Copy,
  RotateCw,
  Stamp,
  Scissors,
  Layers,
  Type,
  ShieldCheck,
} from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';

interface PdfWorkspaceProps {
  utility: UtilityPublicDto;
}

export const PdfWorkspace: React.FC<PdfWorkspaceProps> = ({ utility }) => {
  // Single file state (for compressor, split, pdf-to-jpg, rotator, watermark, etc.)
  const [singleFile, setSingleFile] = useState<{ file: File; base64: string } | null>(null);

  // Multi file state (for merge)
  const [mergeFiles, setMergeFiles] = useState<Array<{ file: File; base64: string }>>([]);

  // Tool type flags
  const isMerge = utility.slug === 'pdf-merge';
  const isSplit = utility.slug === 'pdf-split';
  const isPdfToJpg = utility.slug === 'pdf-to-jpg';
  const isPdfToPng = utility.slug === 'pdf-to-png';
  const isPdfToText = utility.slug === 'pdf-to-text';
  const isCompress = utility.slug === 'pdf-compressor';
  const isPageExtractor = utility.slug === 'pdf-page-extractor';
  const isRotator = utility.slug === 'pdf-rotator';
  const isWatermark = utility.slug === 'pdf-watermark';
  const isReorder = utility.slug === 'pdf-reorder-pages';
  const isMetadataRemover = utility.slug === 'pdf-metadata-remover';

  // Configuration state
  const [pageRanges, setPageRanges] = useState<string>('1-3');
  const [pdfToJpgPage, setPdfToJpgPage] = useState<'all' | number>('all');
  const [scale, setScale] = useState<number>(1.5);
  const [profile, setProfile] = useState<'EXTREME' | 'BALANCED' | 'VISUALLY_LOSSLESS'>('EXTREME');
  const [compressStep, setCompressStep] = useState<string>('Analyzing PDF...');
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Rotator options
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [rotatorPageMode, setRotatorPageMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [rotatorCustomPages, setRotatorCustomPages] = useState<string>('1');

  // Watermark options
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkPosition, setWatermarkPosition] = useState<'DIAGONAL' | 'CENTER' | 'TOP' | 'BOTTOM'>('DIAGONAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(42);
  const [watermarkColorHex, setWatermarkColorHex] = useState<string>('#666666');

  // Reorder options
  const [pageOrder, setPageOrder] = useState<string>('1, 2');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    dataUrl: string;
    filename: string;
    sizeBytes: number;
    mimeType?: string;
    savingsPercent?: number;
    savedBytes?: number;
    originalSizeBytes?: number;
    compressedSizeBytes?: number;
    profile?: string;
    wasActuallyCompressed?: boolean;
    pageCount?: number;
    text?: string;
    charCount?: number;
    wordCount?: number;
    hasSelectableText?: boolean;
    extractedPages?: number[];
    rotatedAngle?: number;
    removedFields?: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading || !isCompress) return;
    const steps = [
      'Analyzing PDF structure & forensic breakdown...',
      'Finding large embedded resources & XObjects...',
      'Optimizing raster images & ICC color profiles...',
      'Downsampling oversized images to screen dimensions...',
      'Trying compression candidates (Target: ≤1 MB)...',
      'Measuring candidate PDF sizes...',
      'Validating final PDF integrity & page count...',
      'Selecting smallest valid PDF...',
    ];
    let idx = 0;
    setCompressStep(steps[0]);
    const timer = setInterval(() => {
      idx = (idx + 1) % steps.length;
      setCompressStep(steps[idx]);
    }, 1800);
    return () => clearInterval(timer);
  }, [isLoading, isCompress]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFilesAdded = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setErrorMsg(null);
    setResultData(null);
    setCopiedText(false);

    const pdfFiles = Array.from(filesList).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));

    if (pdfFiles.length === 0) {
      setErrorMsg('Please select valid PDF document files.');
      return;
    }

    if (isMerge) {
      const remainingSlots = 10 - mergeFiles.length;
      if (remainingSlots <= 0) {
        setErrorMsg('Maximum 10 PDF files can be merged at once.');
        return;
      }
      const filesToProcess = pdfFiles.slice(0, remainingSlots);
      const newItems: Array<{ file: File; base64: string }> = [];

      for (const f of filesToProcess) {
        if (f.size > 25 * 1024 * 1024) {
          setErrorMsg(`File ${f.name} exceeds the 25MB limit.`);
          return;
        }
        const base64 = await readFileAsBase64(f);
        newItems.push({ file: f, base64 });
      }

      setMergeFiles((prev) => [...prev, ...newItems]);
    } else {
      const first = pdfFiles[0];
      if (first.size > 25 * 1024 * 1024) {
        setErrorMsg('PDF file exceeds the 25MB limit.');
        return;
      }
      const base64 = await readFileAsBase64(first);
      setSingleFile({ file: first, base64 });
    }
  };

  const handleExecute = async () => {
    setErrorMsg(null);
    setResultData(null);
    setCopiedText(false);
    setIsLoading(true);

    const startTime = performance.now();
    trackToolStart(utility.slug);

    try {
      const apiUrl = getClientApiUrl();
      let payload: any = {};

      if (isMerge) {
        if (mergeFiles.length < 2) {
          throw new Error('Please select at least 2 PDF files to merge.');
        }
        payload = {
          files: mergeFiles.map((item) => ({
            fileData: item.base64,
            filename: item.file.name,
          })),
        };
      } else {
        if (!singleFile) {
          throw new Error('Please select a PDF document first.');
        }
        payload = {
          fileData: singleFile.base64,
          filename: singleFile.file.name,
        };

        if (isSplit || isPageExtractor) {
          payload.pageRanges = pageRanges;
        } else if (isPdfToJpg) {
          payload.page = pdfToJpgPage;
          payload.scale = scale;
        } else if (isPdfToPng) {
          payload.scale = scale;
        } else if (isCompress) {
          payload.profile = profile;
        } else if (isRotator) {
          payload.angle = rotateAngle;
          payload.pages = rotatorPageMode === 'ALL' ? 'ALL' : rotatorCustomPages;
        } else if (isWatermark) {
          if (!watermarkText.trim()) {
            throw new Error('Please enter watermark text.');
          }
          payload.watermarkText = watermarkText.trim();
          payload.position = watermarkPosition;
          payload.opacity = watermarkOpacity;
          payload.fontSize = watermarkFontSize;
          payload.colorHex = watermarkColorHex;
        } else if (isReorder) {
          const order = pageOrder
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0);
          if (order.length === 0) {
            throw new Error('Please provide valid comma-separated page numbers.');
          }
          payload.pageOrder = order;
        }
      }

      const res = await fetch(`${apiUrl}/utilities/${utility.slug}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'PDF processing failed');
      }

      const output = json.data.result;

      // Handle dataUrl fallback for text extractor if needed
      let dataUrl = output.dataUrl || '';
      let sizeBytes = output.sizeBytes || output.compressedSizeBytes || 0;
      if (!dataUrl && output.text) {
        dataUrl = `data:text/plain;charset=utf-8;base64,${btoa(unescape(encodeURIComponent(output.text)))}`;
      }
      if (!sizeBytes && output.text) {
        sizeBytes = new Blob([output.text]).size;
      }

      const baseName = singleFile?.file?.name ? singleFile.file.name.replace(/\.[^/.]+$/, '') : 'document';
      const fallbackFilename = isPdfToText
        ? `${baseName}_extracted.txt`
        : isPdfToPng
        ? `${baseName}_pages.png`
        : isRotator
        ? `${baseName}_rotated_${rotateAngle}deg.pdf`
        : isWatermark
        ? `${baseName}_watermarked.pdf`
        : 'processed.pdf';

      setResultData({
        dataUrl,
        filename: output.filename || fallbackFilename,
        sizeBytes,
        originalSizeBytes: output.originalSizeBytes,
        compressedSizeBytes: output.compressedSizeBytes,
        savedBytes: output.savedBytes,
        savingsPercent: output.savingsPercent,
        profile: output.profile,
        wasActuallyCompressed: output.wasActuallyCompressed,
        mimeType: output.mimeType,
        pageCount: output.pageCount || output.totalPageCount,
        text: output.text,
        charCount: output.charCount,
        wordCount: output.wordCount,
        hasSelectableText: output.hasSelectableText,
        extractedPages: output.extractedPages,
        rotatedAngle: output.rotatedAngle || rotateAngle,
        removedFields: output.removedFields,
      });

      const elapsed = Math.round(performance.now() - startTime);
      trackToolComplete(utility.slug, elapsed);
    } catch (err: any) {
      const msg = err.message || 'Operation failed';
      setErrorMsg(msg);
      trackToolError(utility.slug, msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultData) return;
    trackResultDownload(utility.slug, { filename: resultData.filename, sizeBytes: resultData.sizeBytes });

    let downloadUrl = resultData.dataUrl;
    let cleanupBlob = false;

    if (!downloadUrl && resultData.text) {
      const blob = new Blob([resultData.text], { type: 'text/plain;charset=utf-8' });
      downloadUrl = URL.createObjectURL(blob);
      cleanupBlob = true;
    }

    if (!downloadUrl) return;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = resultData.filename || 'processed.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (cleanupBlob) {
      URL.revokeObjectURL(downloadUrl);
    }
  };

  const handleCopyText = async () => {
    if (!resultData?.text) return;
    try {
      await navigator.clipboard.writeText(resultData.text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      // Fallback
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const watermarkColorPresets = [
    { label: 'Gray', hex: '#666666', bg: 'bg-[#666666]' },
    { label: 'Red', hex: '#DC2626', bg: 'bg-red-600' },
    { label: 'Blue', hex: '#2563EB', bg: 'bg-blue-600' },
    { label: 'Black', hex: '#000000', bg: 'bg-black' },
    { label: 'Emerald', hex: '#16A34A', bg: 'bg-emerald-600' },
    { label: 'Orange', hex: '#EA580C', bg: 'bg-orange-600' },
  ];

  const watermarkTextPresets = ['CONFIDENTIAL', 'DO NOT COPY', 'SAMPLE', 'DRAFT', 'APPROVED', 'ORIGINAL'];

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            {isRotator ? (
              <RotateCw className="w-5 h-5" />
            ) : isWatermark ? (
              <Stamp className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name} Workspace</h2>
            <p className="text-xs text-slate-500">Server stream processing &bull; Privacy protected</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* Upload Zone */}
      {(!isMerge && !singleFile) || (isMerge && mergeFiles.length === 0) ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300/80 hover:border-blue-500/80 bg-slate-50/60 hover:bg-blue-50/30 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple={isMerge}
            className="hidden"
            onChange={(e) => handleFilesAdded(e.target.files)}
          />
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-blue-600 shadow-xs group-hover:scale-105 transition-transform">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {isMerge ? 'Select multiple PDF files to merge' : 'Drag & drop your PDF file, or browse'}
          </h3>
          <p className="text-xs text-slate-500">
            {isMerge ? 'Add up to 10 files (max 50MB combined)' : 'PDF documents up to 25MB'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Selected Area */}
          {isMerge ? (
            /* Multi-file List */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Files to Merge ({mergeFiles.length} / 10)
                </span>
                {mergeFiles.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add More Files
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesAdded(e.target.files)}
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {mergeFiles.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-mono font-bold">
                        {idx + 1}
                      </span>
                      <span className="truncate font-medium text-slate-800">{item.file.name}</span>
                      <span className="text-xs text-slate-500 font-mono">({formatBytes(item.file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMergeFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Single file card */
            singleFile && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-red-600 shadow-xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-sm">{singleFile.file.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{formatBytes(singleFile.file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSingleFile(null);
                    setResultData(null);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-lg shadow-xs hover:bg-rose-50 transition-colors"
                >
                  Change File
                </button>
              </div>
            )
          )}

          {/* PDF Rotator Dedicated Controls */}
          {isRotator && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCw className="w-4 h-4 text-blue-600" />
                    Rotation Angle
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">Applies clockwise rotation</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      angle: 90 as const,
                      label: '90° Clockwise',
                      desc: 'Rotate 90 degrees right',
                      badge: 'Standard',
                      iconRotation: 'rotate-90',
                    },
                    {
                      angle: 180 as const,
                      label: '180° Half Turn',
                      desc: 'Flip page upside down',
                      badge: 'Flip',
                      iconRotation: 'rotate-180',
                    },
                    {
                      angle: 270 as const,
                      label: '270° Counter-CW',
                      desc: 'Rotate 90 degrees left',
                      badge: 'Left',
                      iconRotation: '-rotate-90',
                    },
                  ].map((item) => {
                    const isSelected = rotateAngle === item.angle;
                    return (
                      <button
                        key={item.angle}
                        type="button"
                        onClick={() => setRotateAngle(item.angle)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-blue-50/90 border-2 border-blue-600 text-blue-950 font-bold shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm font-bold flex items-center gap-2 ${isSelected ? 'text-blue-600' : 'text-slate-900'}`}>
                            <RotateCw className={`w-4 h-4 transition-transform duration-300 ${item.iconRotation}`} />
                            {item.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-normal">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Page Selection */}
              <div className="pt-4 border-t border-slate-200/80 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  Target Pages
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRotatorPageMode('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      rotatorPageMode === 'ALL'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    All Pages in PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotatorPageMode('CUSTOM')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      rotatorPageMode === 'CUSTOM'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Specific Page Numbers / Range
                  </button>
                </div>

                {rotatorPageMode === 'CUSTOM' && (
                  <div className="space-y-2 mt-2">
                    <input
                      type="text"
                      value={rotatorCustomPages}
                      onChange={(e) => setRotatorCustomPages(e.target.value)}
                      placeholder="e.g. 1, 3, 5-8"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">Quick presets:</span>
                      {[
                        { label: 'Page 1 Only', value: '1' },
                        { label: 'First 3 Pages', value: '1-3' },
                        { label: 'Odd Pages (1,3,5)', value: '1, 3, 5, 7, 9' },
                        { label: 'Even Pages (2,4,6)', value: '2, 4, 6, 8, 10' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setRotatorCustomPages(preset.value)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-xs"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PDF Watermark Dedicated Controls */}
          {isWatermark && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-5">
              {/* Watermark text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-emerald-600" />
                    Watermark Text
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">Printed on every page</span>
                </div>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL, DO NOT COPY, SAMPLE"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 mr-1 font-medium">Presets:</span>
                  {watermarkTextPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWatermarkText(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        watermarkText === preset
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Watermark Position */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Stamp Position & Angle
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'DIAGONAL' as const, label: 'Diagonal (45°)', desc: 'Full page diagonal' },
                    { id: 'CENTER' as const, label: 'Center', desc: 'Horizontal middle' },
                    { id: 'TOP' as const, label: 'Top Header', desc: 'Upper margin' },
                    { id: 'BOTTOM' as const, label: 'Bottom Footer', desc: 'Lower margin' },
                  ].map((pos) => {
                    const isSelected = watermarkPosition === pos.id;
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setWatermarkPosition(pos.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-bold shadow-xs ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className={`text-xs font-bold block ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>
                          {pos.label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">{pos.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color & Size & Opacity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/80">
                {/* Color Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Stamp Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {watermarkColorPresets.map((c) => {
                      const isSelected = watermarkColorHex === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setWatermarkColorHex(c.hex)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${c.bg} ${
                            isSelected ? 'ring-2 ring-emerald-500 scale-110 border-white shadow-xs' : 'border-slate-300 opacity-80 hover:opacity-100'
                          }`}
                          title={c.label}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Font Size ({watermarkFontSize}px)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[24, 36, 42, 54, 72].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setWatermarkFontSize(sz)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          watermarkFontSize === sz
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 uppercase tracking-wider">Opacity</span>
                    <span className="text-emerald-600 font-mono font-bold">{Math.round(watermarkOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.90"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Watermark Live Preview Box */}
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200/90 text-center relative overflow-hidden h-28 flex items-center justify-center shadow-inner">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest absolute top-2 left-3 font-bold">
                  Live Watermark Visualizer
                </p>
                <span
                  style={{
                    color: watermarkColorHex,
                    opacity: watermarkOpacity,
                    fontSize: `${Math.min(28, watermarkFontSize * 0.55)}px`,
                    transform:
                      watermarkPosition === 'DIAGONAL'
                        ? 'rotate(-25deg)'
                        : watermarkPosition === 'TOP'
                        ? 'translateY(-20px)'
                        : watermarkPosition === 'BOTTOM'
                        ? 'translateY(20px)'
                        : 'none',
                  }}
                  className="font-black font-sans uppercase tracking-widest transition-all select-none"
                >
                  {watermarkText || 'WATERMARK'}
                </span>
              </div>
            </div>
          )}

          {/* PDF Compressor Profile Controls */}
          {isCompress && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Compression Profile
                </label>
                <span className="text-[11px] text-slate-500 font-medium">Target: ≤1 MB when achievable</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'EXTREME',
                    name: 'Extreme',
                    desc: 'Aggressively optimizes raster content • Target: ≤1 MB when achievable',
                    badge: 'Default • Smallest Size',
                    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  },
                  {
                    id: 'BALANCED',
                    name: 'Balanced',
                    desc: 'Strong compression with clear layout & text readability',
                    badge: 'Recommended',
                    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
                  },
                  {
                    id: 'VISUALLY_LOSSLESS',
                    name: 'Visually Lossless',
                    desc: 'Highest quality • Prioritizes visual fidelity over size',
                    badge: 'High Fidelity',
                    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
                  },
                ].map((lvl) => {
                  const isSelected = profile === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setProfile(lvl.id as any)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-blue-50/90 border-2 border-blue-600 text-blue-950 font-bold shadow-xs ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                          {lvl.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${lvl.badgeColor}`}>
                          {lvl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal leading-snug">{lvl.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Split & Page Extractor Controls */}
          {(isSplit || isPageExtractor) && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <label htmlFor="page-ranges" className="block text-xs font-bold text-slate-800 uppercase">
                Page Range to Extract
              </label>
              <input
                id="page-ranges"
                type="text"
                value={pageRanges}
                onChange={(e) => setPageRanges(e.target.value)}
                placeholder="e.g. 1-3, 5, 8-10"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 font-medium">
                Specify pages separated by commas or hyphens (e.g. &ldquo;1-3, 5, 8-10&rdquo;).
              </p>
            </div>
          )}

          {/* PDF to JPG Controls */}
          {isPdfToJpg && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 uppercase">Pages to Convert</label>
                <select
                  value={typeof pdfToJpgPage === 'number' ? pdfToJpgPage : 'all'}
                  onChange={(e) => setPdfToJpgPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="all">All Pages (Download ZIP)</option>
                  <option value="1">Page 1 Only (Single JPG)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 uppercase">Render Scale</label>
                <select
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="1.0">1.0x (Standard - Fast)</option>
                  <option value="1.5">1.5x (High Quality - Recommended)</option>
                  <option value="2.0">2.0x (Ultra Crisp)</option>
                </select>
              </div>
            </div>
          )}

          {/* PDF to PNG Controls */}
          {isPdfToPng && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 uppercase">Render Scale (DPI)</label>
                <select
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="1.0">1.0x (Standard 72 DPI)</option>
                  <option value="1.5">1.5x (High Quality 150 DPI - Recommended)</option>
                  <option value="2.0">2.0x (Ultra Crisp 300 DPI)</option>
                </select>
              </div>
            </div>
          )}

          {/* PDF Metadata Remover Information */}
          {isMetadataRemover && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Privacy Sanitization</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed font-normal">
                  Removes all author names, editing software tags, organization names, hidden dates, and revision histories permanently.
                </p>
              </div>
            </div>
          )}

          {/* PDF Reorder Pages Controls */}
          {isReorder && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase">Page Sequence</label>
              <input
                type="text"
                value={pageOrder}
                onChange={(e) => setPageOrder(e.target.value)}
                placeholder="e.g. 3, 1, 2"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 font-medium">
                Specify new sequence of 1-based page numbers separated by commas.
              </p>
            </div>
          )}

          {/* Result Box */}
          {resultData && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{resultData.filename}</p>
                    {isCompress && resultData.originalSizeBytes ? (
                      <div className="text-xs text-slate-600 space-y-0.5 mt-0.5">
                        <p>
                          Original: <span className="text-slate-800 font-mono font-medium">{formatBytes(resultData.originalSizeBytes)}</span>
                          {' '}&rarr; Output: <span className="text-emerald-700 font-bold font-mono">{formatBytes(resultData.compressedSizeBytes || resultData.sizeBytes)}</span>
                          {resultData.wasActuallyCompressed && (
                            <span className="text-emerald-700 ml-1.5 font-bold">
                              (Saved {formatBytes(resultData.savedBytes || 0)} • {resultData.savingsPercent}%)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Profile: <strong className="text-slate-700">{resultData.profile || profile}</strong></span>
                          {resultData.pageCount && <span>• {resultData.pageCount} pages</span>}
                          {!resultData.wasActuallyCompressed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-800 font-semibold">
                              Already highly optimized
                            </span>
                          )}
                        </p>
                      </div>
                    ) : isPdfToText ? (
                      <p className="text-xs text-slate-600 mt-0.5">
                        Output size: <span className="text-emerald-700 font-mono font-bold">{formatBytes(resultData.sizeBytes)}</span>
                        {resultData.pageCount && ` • ${resultData.pageCount} pages`}
                        {resultData.charCount !== undefined && ` • ${resultData.charCount.toLocaleString()} chars`}
                        {resultData.wordCount !== undefined && ` • ${resultData.wordCount.toLocaleString()} words`}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-600 mt-0.5">
                        Output size: <span className="font-mono font-bold text-slate-800">{formatBytes(resultData.sizeBytes)}</span>
                        {typeof resultData.savingsPercent === 'number' && ` • Saved ${resultData.savingsPercent}%`}
                        {resultData.pageCount && ` • ${resultData.pageCount} pages`}
                        {resultData.rotatedAngle && ` • Rotated ${resultData.rotatedAngle}°`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {isPdfToText && resultData.text && (
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-sm font-semibold text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Text</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold text-white shadow-sm shadow-emerald-600/25 flex items-center gap-2 transition-all hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

              {/* Text preview box for PDF to Text */}
              {isPdfToText && resultData.text && (
                <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Extracted Text Content
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedText ? 'Copied to Clipboard' : 'Copy All'}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-mono max-h-80 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed select-text shadow-inner">
                    {resultData.text}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action button */}
          {!resultData && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={isLoading || (isMerge && mergeFiles.length < 2)}
              className="w-full px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.995]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> {isCompress ? compressStep : 'Processing PDF...'}
                </>
              ) : (
                <>Run {utility.name}</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-800">Operation Error</p>
            <p className="text-rose-700 text-xs mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
