'use client';

import React, { useState, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import { Video, Upload, Download, RefreshCw, AlertCircle, Scissors, Sliders, Check } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';

interface VideoWorkspaceProps {
  utility: UtilityPublicDto;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ utility }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);

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

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setResultData(null);

    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 50MB limit. Please select a smaller video.');
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
            {utility.slug === 'video-trimmer' ? <Scissors className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name} Workspace</h2>
            <p className="text-xs text-slate-500">FFmpeg hardware-accelerated processing &bull; Privacy protected</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* Upload Dropzone */}
      {!selectedFile && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300/80 hover:border-blue-500/80 bg-slate-50/60 hover:bg-blue-50/30 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all space-y-3 group"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-blue-600 shadow-xs group-hover:scale-105 transition-transform">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Click or drag a video to upload</h3>
            <p className="text-xs text-slate-500 mt-1">Supports MP4, WebM, MOV (Max 50MB)</p>
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
                <span className="font-mono">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB {duration ? `• ${duration}s` : ''}</span>
              </div>
            </div>

            {/* Options */}
            <div className="lg:col-span-6 space-y-4">
              {utility.slug === 'video-compressor' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Compression Level</label>
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Max Resolution</label>
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Audio Bitrate</label>
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Start Time (sec)</label>
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">End Time (sec)</label>
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
    </div>
  );
};
