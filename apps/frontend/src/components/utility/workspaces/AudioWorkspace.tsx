'use client';

import React, { useState, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import { Music, Upload, Download, RefreshCw, AlertCircle, Scissors, Sliders, Check } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';

interface AudioWorkspaceProps {
  utility: UtilityPublicDto;
}

export const AudioWorkspace: React.FC<AudioWorkspaceProps> = ({ utility }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);

  const [startTimeSec, setStartTimeSec] = useState<number>(0);
  const [endTimeSec, setEndTimeSec] = useState<number>(30);
  const [bitrate, setBitrate] = useState<'64k' | '128k' | '192k' | '256k'>('192k');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    dataUrl: string;
    filename: string;
    sizeBytes?: number;
    durationSec?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setResultData(null);

    if (file.size > 30 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 30MB limit. Please select a smaller audio file.');
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

      if (utility.slug === 'audio-cutter') {
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
        throw new Error(json.message || json.error?.message || 'Audio processing failed');
      }

      const output = json.data.result;
      setResultData({
        dataUrl: output.dataUrl,
        filename: output.filename || 'processed-audio.mp3',
        sizeBytes: output.sizeBytes,
        durationSec: output.durationSec,
      });

      trackToolComplete(utility.slug, Math.round(performance.now() - startTime));
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during audio processing');
      trackToolError(utility.slug, err.message || 'Audio processing error');
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
    trackResultDownload(utility.slug, { mimeType: 'audio/mp3' });
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 sm:p-8 space-y-6">
      {!selectedFile && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-950/40 space-y-3"
        >
          <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white font-medium">Click or drag an audio file to upload</p>
            <p className="text-xs text-slate-400 mt-1">Supports MP3, WAV, OGG, M4A (Max 30MB)</p>
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
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium text-sm">{selectedFile.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB {duration ? `• ${duration}s` : ''}
                </p>
              </div>
              <audio ref={audioRef} src={fileUrl} controls onLoadedMetadata={handleLoadedMetadata} className="h-10" />
            </div>

            {utility.slug === 'audio-cutter' && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Start Time (sec)</label>
                  <input
                    type="number"
                    min="0"
                    max={duration}
                    value={startTimeSec}
                    onChange={(e) => setStartTimeSec(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">End Time (sec)</label>
                  <input
                    type="number"
                    min="1"
                    max={duration || 300}
                    value={endTimeSec}
                    onChange={(e) => setEndTimeSec(parseFloat(e.target.value) || 30)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
                  />
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
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
              >
                Change
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultData && (
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  Audio Ready
                </h3>
                <p className="text-xs text-slate-300 mt-1">{resultData.filename}</p>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors"
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
