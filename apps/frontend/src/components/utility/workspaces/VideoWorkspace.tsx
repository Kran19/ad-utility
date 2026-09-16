'use client';

import React, { useState, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import {
  Video,
  Upload,
  Download,
  RefreshCw,
  AlertCircle,
  Scissors,
  Check,
  Link as LinkIcon,
  Globe,
  ShieldCheck,
  Film,
  ExternalLink,
} from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';
import { useUserAuth } from '../../../context/user-auth-context';
import { validateFileSecurity } from '../../../lib/file-security';

interface VideoWorkspaceProps {
  utility: UtilityPublicDto;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ utility }) => {
  const { requireAuth } = useUserAuth();
  const isDownloader = utility.slug === 'video-downloader';

  // URL Downloader State
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [downloadStep, setDownloadStep] = useState<string>('');
  const [downloaderResult, setDownloaderResult] = useState<{
    downloadUrl: string;
    downloadToken: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    format: string;
    duration?: number;
    width?: number;
    height?: number;
  } | null>(null);

  // File Upload State (for compressor, trimmer, converter, etc.)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Settings
  const [targetQuality, setTargetQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [maxResolution, setMaxResolution] = useState<'original' | '1080p' | '720p' | '480p'>('720p');
  const [startTimeSec, setStartTimeSec] = useState<number>(0);
  const [endTimeSec, setEndTimeSec] = useState<number>(10);
  const [bitrate, setBitrate] = useState<'128k' | '192k' | '256k' | '320k'>('192k');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    dataUrl: string;
    filename: string;
    sizeBytes?: number;
    originalSizeBytes?: number;
    savingsPercent?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Handlers for URL Downloader ---
  const handleUrlDownload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!requireAuth(() => handleUrlDownload(), `Sign in or register to download videos`)) return;
    const cleanUrl = videoUrl.trim();
    if (!cleanUrl) {
      setErrorMsg('Please enter a valid video URL.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setDownloaderResult(null);
    setDownloadStep('Validating URL & security checks...');

    const startTime = performance.now();
    trackToolStart(utility.slug);

    try {
      const stepTimer1 = setTimeout(() => setDownloadStep('Connecting to remote video source...'), 600);
      const stepTimer2 = setTimeout(() => setDownloadStep('Downloading & verifying video stream...'), 1800);
      const stepTimer3 = setTimeout(() => setDownloadStep('Validating media integrity & probe metadata...'), 3200);

      const apiUrl = getClientApiUrl();
      const res = await fetch(`${apiUrl}/utilities/video-downloader/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { url: cleanUrl } }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Video download failed.');
      }

      const output = json.data.result;
      setDownloaderResult(output);
      setDownloadStep('Video Ready');
      trackToolComplete(utility.slug, Math.round(performance.now() - startTime));
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during video download');
      trackToolError(utility.slug, err.message || 'Video download error');
      setDownloadStep('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerBinaryDownload = () => {
    if (!downloaderResult) return;
    const apiUrl = getClientApiUrl();
    const fullDownloadUrl = `${apiUrl}${downloaderResult.downloadUrl}`;

    const link = document.createElement('a');
    link.href = fullDownloadUrl;
    link.download = downloaderResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    trackResultDownload(utility.slug, { mimeType: downloaderResult.mimeType });
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setVideoUrl(text.trim());
          setErrorMsg(null);
        }
      }
    } catch {}
  };

  // --- Handlers for File-based Video Tools ---
  const handleFileSelect = async (file: File) => {
    setErrorMsg(null);
    setResultData(null);

    const securityCheck = await validateFileSecurity(file, { category: 'video' });
    if (!securityCheck.valid) {
      setErrorMsg(securityCheck.error || 'Video file validation failed.');
      return;
    }

    setSelectedFile(file);
    const objUrl = URL.createObjectURL(file);
    setFileUrl(objUrl);

    const reader = new FileReader();
    reader.onload = () => setFileBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = Math.round(videoRef.current.duration);
      setDuration(dur);
      setEndTimeSec(Math.min(dur, 10));
    }
  };

  const handleProcess = async () => {
    if (!requireAuth(handleProcess, `Sign in or create a free account to process videos with ${utility.name}`)) return;
    if (!selectedFile || !fileBase64) return;

    setIsLoading(true);
    setErrorMsg(null);
    setResultData(null);

    const startTime = performance.now();
    trackToolStart(utility.slug);

    try {
      const apiUrl = getClientApiUrl();
      const payload: any = {
        fileData: fileBase64,
        filename: selectedFile.name,
      };

      if (utility.slug === 'video-compressor') {
        payload.targetQuality = targetQuality;
        payload.maxResolution = maxResolution;
      } else if (utility.slug === 'mp4-to-mp3') {
        payload.bitrate = bitrate;
      } else if (utility.slug === 'video-to-gif') {
        payload.startTimeSec = startTimeSec;
        payload.durationSec = Math.min(15, Math.max(1, endTimeSec - startTimeSec));
      } else if (utility.slug === 'video-trimmer') {
        payload.startTimeSec = startTimeSec;
        payload.endTimeSec = endTimeSec;
      }

      const res = await fetch(`${apiUrl}/utilities/${utility.slug}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Video processing failed');
      }

      const output = json.data.result;
      setResultData({
        dataUrl: output.dataUrl,
        filename: output.filename || 'processed-video',
        sizeBytes: output.sizeBytes || output.compressedSizeBytes,
        originalSizeBytes: output.originalSizeBytes,
        savingsPercent: output.savingsPercent,
      });

      trackToolComplete(utility.slug, Math.round(performance.now() - startTime));
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during video processing');
      trackToolError(utility.slug, err.message || 'Video processing error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultData) return;
    const link = document.createElement('a');
    link.href = resultData.dataUrl;
    link.download = resultData.filename;
    link.click();
    trackResultDownload(utility.slug, { mimeType: utility.slug === 'mp4-to-mp3' ? 'audio/mp3' : 'video/mp4' });
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
            {isDownloader ? (
              <Globe className="w-5 h-5" />
            ) : utility.slug === 'video-trimmer' ? (
              <Scissors className="w-5 h-5" />
            ) : (
              <Video className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name} Workspace</h2>
            <p className="text-xs text-slate-500">
              {isDownloader
                ? 'Download Instagram Reels, YouTube Videos & Shorts, and direct MP4/WebM streams'
                : 'FFmpeg hardware-accelerated processing • Privacy protected'}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* 1. URL Downloader Mode */}
      {isDownloader ? (
        <div className="space-y-6">
          <form onSubmit={handleUrlDownload} className="space-y-4">
            <div>
              <label htmlFor="video-url-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Instagram Reel / YouTube / Direct Video URL
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  id="video-url-input"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste Instagram Reel, YouTube Video, Shorts, or MP4 link..."
                  className="w-full pl-10 pr-24 py-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="absolute right-2.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
                >
                  Paste
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Supports Instagram Reels • YouTube Videos/Shorts • Direct MP4/WebM</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVideoUrl('');
                    setErrorMsg(null);
                    setDownloaderResult(null);
                    setDownloadStep('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  disabled={isLoading}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !videoUrl.trim()}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{downloadStep || 'Downloading...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Video</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Progress / Step indicator */}
          {isLoading && downloadStep && (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-blue-900">{downloadStep}</p>
                <p className="text-blue-700 mt-0.5">Streaming directly through hardened server-side pipeline</p>
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">Download Failed</p>
                <p className="text-xs text-rose-800 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Downloader Result Card */}
          {downloaderResult && (
            <div className="p-6 rounded-2xl bg-emerald-50/90 border border-emerald-200 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-200/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">Video Successfully Retrieved & Validated</h3>
                    <p className="text-xs text-emerald-800">
                      Integrity verified • Ready for instant download
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerBinaryDownload}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File ({downloaderResult.format.toUpperCase()})</span>
                </button>
              </div>

              {/* Video Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100">
                  <span className="text-slate-500 block">File Name</span>
                  <span className="font-bold text-slate-800 truncate block mt-0.5" title={downloaderResult.filename}>
                    {downloaderResult.filename}
                  </span>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100">
                  <span className="text-slate-500 block">File Size</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    {(downloaderResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100">
                  <span className="text-slate-500 block">Format / MIME</span>
                  <span className="font-bold text-slate-800 block mt-0.5 uppercase">
                    {downloaderResult.format} ({downloaderResult.mimeType.split('/')[1]})
                  </span>
                </div>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100">
                  <span className="text-slate-500 block">Duration / Resolution</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    {downloaderResult.duration ? `${downloaderResult.duration}s` : 'N/A'}{' '}
                    {downloaderResult.width && downloaderResult.height
                      ? `(${downloaderResult.width}x${downloaderResult.height})`
                      : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 2. File Upload Mode for Other Video Tools */
        <>
          {/* Upload Dropzone */}
          {!selectedFile && (
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
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all space-y-3 group ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/60 scale-[0.99] ring-4 ring-blue-500/10'
                  : 'border-slate-300/80 hover:border-blue-500/80 bg-slate-50/60 hover:bg-blue-50/30'
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-blue-600 shadow-xs group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Drag & drop your video here, or <span className="text-blue-600 underline">browse</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">Supports MP4, WebM, MOV (Max 200MB)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          )}

          {/* Selected video view & settings */}
          {selectedFile && fileUrl && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Player Preview */}
                <div className="lg:col-span-6 bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 flex flex-col justify-between">
                  <video
                    ref={videoRef}
                    src={fileUrl}
                    controls
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full max-h-64 object-contain mx-auto bg-slate-900"
                  />
                  <div className="p-3.5 bg-white flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
                    <span className="font-bold text-slate-800 truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB {duration ? `• ${duration}s` : ''}
                    </span>
                  </div>
                </div>

                {/* Options */}
                <div className="lg:col-span-6 space-y-4">
                  {utility.slug === 'video-compressor' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Compression Level
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['high', 'medium', 'low'] as const).map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setTargetQuality(lvl)}
                              className={`px-3 py-2.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                                targetQuality === lvl
                                  ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {lvl === 'high' ? 'High Quality' : lvl === 'medium' ? 'Balanced' : 'Smallest Size'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Max Resolution
                        </label>
                        <select
                          value={maxResolution}
                          onChange={(e) => setMaxResolution(e.target.value as any)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="original">Original Resolution</option>
                          <option value="1080p">1080p (Full HD)</option>
                          <option value="720p">720p (HD)</option>
                          <option value="480p">480p (SD)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {utility.slug === 'mp4-to-mp3' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Audio Bitrate
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['128k', '192k', '256k', '320k'] as const).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBitrate(b)}
                            className={`px-2 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                              bitrate === b
                                ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(utility.slug === 'video-trimmer' || utility.slug === 'video-to-gif') && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Start Time (sec)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={duration}
                            value={startTimeSec}
                            onChange={(e) => setStartTimeSec(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            End Time (sec)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={duration || 180}
                            value={endTimeSec}
                            onChange={(e) => setEndTimeSec(parseFloat(e.target.value) || 10)}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={handleProcess}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing Media...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Execute {utility.name}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFileUrl(null);
                        setResultData(null);
                      }}
                      className="px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Result Card */}
              {resultData && (
                <div className="p-6 rounded-2xl bg-emerald-50/90 border border-emerald-200 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-emerald-900 font-bold flex items-center gap-2">
                        <Check className="w-5 h-5 text-emerald-600" />
                        Conversion Complete
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        Output: <span className="font-bold text-slate-800">{resultData.filename}</span>{' '}
                        {resultData.sizeBytes ? `(${(resultData.sizeBytes / 1024 / 1024).toFixed(2)} MB)` : ''}
                        {resultData.savingsPercent ? ` • Saved ${resultData.savingsPercent}%` : ''}
                      </p>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download File
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
