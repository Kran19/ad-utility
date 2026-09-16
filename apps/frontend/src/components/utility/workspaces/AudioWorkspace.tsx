'use client';

import React, { useState, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import { Music, Upload, Download, RefreshCw, AlertCircle, Scissors, Sliders, Check, Volume2 } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';
import { useUserAuth } from '../../../context/user-auth-context';
import { validateFileSecurity } from '../../../lib/file-security';

interface AudioWorkspaceProps {
  utility: UtilityPublicDto;
}

export const AudioWorkspace: React.FC<AudioWorkspaceProps> = ({ utility }) => {
  const { requireAuth } = useUserAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);

  const [startTimeSec, setStartTimeSec] = useState<number>(0);
  const [endTimeSec, setEndTimeSec] = useState<number>(30);
  const [bitrate, setBitrate] = useState<'64k' | '128k' | '192k' | '256k'>('192k');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    dataUrl: string;
    filename: string;
    sizeBytes?: number;
    durationSec?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMsg(null);
    setResultData(null);

    const securityCheck = await validateFileSecurity(file, { category: 'audio' });
    if (!securityCheck.valid) {
      setErrorMsg(securityCheck.error || 'Audio file validation failed.');
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
    if (audioRef.current) {
      const dur = Math.round(audioRef.current.duration);
      setDuration(dur);
      setEndTimeSec(Math.min(dur, 30));
    }
  };

  const handleProcess = async () => {
    if (!requireAuth(handleProcess, `Sign in or create a free account to process audio with ${utility.name}`)) return;
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

      if (utility.slug === 'audio-compressor') {
        payload.targetBitrate = bitrate;
      } else if (utility.slug === 'audio-cutter') {
        payload.startTime = startTimeSec;
        payload.endTime = endTimeSec;
      } else if (utility.slug === 'audio-converter') {
        payload.format = 'mp3';
      }

      const res = await fetch(`${apiUrl}/utilities/${utility.slug}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Processing audio failed');
      }

      const result = json.data.result;
      setResultData({
        dataUrl: result.dataUrl || result.audioData || result.outputUrl,
        filename: result.filename || `output_${selectedFile.name.replace(/\.[^/.]+$/, '')}.mp3`,
        sizeBytes: result.sizeBytes,
        durationSec: result.durationSec,
      });

      const elapsed = Math.round(performance.now() - startTime);
      trackToolComplete(utility.slug, elapsed);
    } catch (err: any) {
      const msg = err.message || 'Audio execution failed';
      setErrorMsg(msg);
      trackToolError(utility.slug, msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultData?.dataUrl) return;
    trackResultDownload(utility.slug, { filename: resultData.filename });
    const a = document.createElement('a');
    a.href = resultData.dataUrl;
    a.download = resultData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shadow-xs">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name} Workspace</h2>
            <p className="text-xs text-slate-500">In-memory lossless audio stream &bull; Privacy protected</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {utility.implementationMode}
        </span>
      </div>

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
              Drag & drop your audio file here, or <span className="text-blue-600 underline">browse</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">Supports MP3, WAV, OGG, M4A, AAC (Max 200MB)</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </div>
      )}

      {selectedFile && fileUrl && (
        <div className="space-y-6">
          <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-slate-900 font-bold text-sm">{selectedFile.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB {duration ? `• ${duration}s` : ''}
                </p>
              </div>
              <audio ref={audioRef} src={fileUrl} controls onLoadedMetadata={handleLoadedMetadata} className="h-10" />
            </div>

            {utility.slug === 'audio-cutter' && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/80">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Start Time (sec)</label>
                  <input
                    type="number"
                    min="0"
                    max={duration}
                    value={startTimeSec}
                    onChange={(e) => setStartTimeSec(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">End Time (sec)</label>
                  <input
                    type="number"
                    min="1"
                    max={duration || 300}
                    value={endTimeSec}
                    onChange={(e) => setEndTimeSec(parseFloat(e.target.value) || 30)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
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
                    Processing Audio...
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
                className="px-4 py-3.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-bold transition-colors"
              >
                Change
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultData && (
            <div className="p-6 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
              <div>
                <h3 className="text-emerald-900 font-bold flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-600" />
                  Audio Ready
                </h3>
                <p className="text-xs text-slate-600 mt-1 font-medium">{resultData.filename}</p>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition-all"
              >
                <Download className="w-4 h-4" />
                Download Audio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
