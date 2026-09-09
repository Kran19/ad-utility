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
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 sm:p-8 space-y-6">
      {/* Upload Dropzone */}
      {!selectedFile && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-950/40 space-y-3"
        >
          <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white font-medium">Click or drag a video to upload</p>
            <p className="text-xs text-slate-400 mt-1">Supports MP4, WebM, MOV (Max 50MB)</p>
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
            <div className="lg:col-span-6 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
              <video
                ref={videoRef}
                src={fileUrl}
                controls
                onLoadedMetadata={handleLoadedMetadata}
                className="w-full max-h-64 object-contain mx-auto"
              />
              <div className="p-3 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
                <span className="font-medium text-slate-300 truncate max-w-[200px]">{selectedFile.name}</span>
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB {duration ? `• ${duration}s` : ''}</span>
              </div>
            </div>

            {/* Options */}
            <div className="lg:col-span-6 space-y-4">
              {utility.slug === 'video-compressor' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Compression Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['high', 'medium', 'low'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setTargetQuality(lvl)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                            targetQuality === lvl
                              ? 'bg-sky-500 text-white shadow-md'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                          }`}
                        >
                          {lvl === 'high' ? 'High Quality' : lvl === 'medium' ? 'Balanced' : 'Smallest Size'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Max Resolution</label>
                    <select
                      value={maxResolution}
                      onChange={(e) => setMaxResolution(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-sky-500"
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
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Audio Bitrate</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['128k', '192k', '256k', '320k'] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBitrate(b)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                          bitrate === b ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'
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
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Start Time (sec)</label>
                      <input
                        type="number"
                        min="0"
                        max={duration}
                        value={startTimeSec}
                        onChange={(e) => setStartTimeSec(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">End Time (sec)</label>
                      <input
                        type="number"
                        min="1"
                        max={duration || 180}
                        value={endTimeSec}
                        onChange={(e) => setEndTimeSec(parseFloat(e.target.value) || 10)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  onClick={handleProcess}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-lg shadow-sky-500/20"
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
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Result Card */}
          {resultData && (
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-400" />
                    Conversion Complete
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Output: {resultData.filename}{' '}
                    {resultData.sizeBytes ? `(${(resultData.sizeBytes / 1024 / 1024).toFixed(2)} MB)` : ''}
                    {resultData.savingsPercent ? ` • Saved ${resultData.savingsPercent}%` : ''}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors"
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
