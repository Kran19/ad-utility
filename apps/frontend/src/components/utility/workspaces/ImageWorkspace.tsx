'use client';

import React, { useState, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import { Upload, Download, Image as ImageIcon, RefreshCw, AlertCircle, Check, Sliders } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';

interface ImageWorkspaceProps {
  utility: UtilityPublicDto;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({ utility }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [quality, setQuality] = useState<number>(utility.slug === 'image-compressor' ? 70 : 85);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    dataUrl: string;
    filename: string;
    sizeBytes: number;
    originalSizeBytes?: number;
    savingsPercent?: number;
    width?: number;
    height?: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setResultData(null);

    // Validate size (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 15MB limit. Please select a smaller image.');
      return;
    }

    // Validate MIME
    const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.jpe?g$/i.test(file.name);
    const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);

    if (utility.slug === 'jpg-to-png' && !isJpg) {
      setErrorMsg('Please select a valid JPG or JPEG image.');
      return;
    }
    if (utility.slug === 'png-to-jpg' && !isPng) {
      setErrorMsg('Please select a valid PNG image.');
      return;
    }
    if (utility.slug === 'image-compressor' && !isJpg && !isPng) {
      setErrorMsg('Please select a valid JPG or PNG image.');
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

      if (utility.slug === 'png-to-jpg' || utility.slug === 'image-compressor') {
        payload.quality = quality;
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
        dataUrl: output.dataUrl,
        filename: output.filename || 'converted-image',
        sizeBytes: output.sizeBytes || output.compressedSizeBytes,
        originalSizeBytes: selectedFile.size,
        savingsPercent: output.savingsPercent,
        width: output.width,
        height: output.height,
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
            <p className="text-xs text-gray-400">Max file size: 15MB &bull; 100% Secure in-memory processing</p>
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
            accept={
              utility.slug === 'jpg-to-png'
                ? 'image/jpeg,image/jpg'
                : utility.slug === 'png-to-jpg'
                ? 'image/png'
                : 'image/jpeg,image/png'
            }
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
            Supports {utility.slug === 'jpg-to-png' ? 'JPG/JPEG' : utility.slug === 'png-to-jpg' ? 'PNG' : 'JPG and PNG'} up to 15MB
          </p>
        </div>
      ) : (
        /* Selected Image View & Controls */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original File Preview */}
            <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-semibold uppercase text-gray-300">Original Image</span>
                <span>{formatBytes(selectedFile.size)}</span>
              </div>
              {filePreview && (
                <div className="relative aspect-video max-h-56 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center border border-gray-800/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={filePreview} alt="Selected preview" className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                <span className="truncate max-w-[200px]" title={selectedFile.name}>{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                    setResultData(null);
                  }}
                  className="text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Change Image
                </button>
              </div>
            </div>

            {/* Controls or Result Preview */}
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
                  <div className="relative aspect-video max-h-56 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center border border-emerald-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultData.dataUrl} alt="Processed output" className="max-h-full max-w-full object-contain" />
                  </div>
                  {typeof resultData.savingsPercent === 'number' && (
                    <div className="text-xs text-center p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-medium">
                      Saved {resultData.savingsPercent}% in file size!
                    </div>
                  )}
                </div>
              ) : (
                /* Conversion Options */
                <div className="space-y-4 my-auto">
                  {(utility.slug === 'png-to-jpg' || utility.slug === 'image-compressor') && (
                    <div className="space-y-2 p-3 rounded-lg bg-gray-900/60 border border-gray-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-medium flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-blue-400" /> Compression Quality
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
                        <span>Smaller Size (10%)</span>
                        <span>Balanced (70%)</span>
                        <span>High Quality (100%)</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 space-y-1.5 leading-relaxed">
                    <p className="font-medium text-gray-300">Ready to convert:</p>
                    <ul className="list-disc list-inside text-gray-400 space-y-1">
                      <li>Authoritative magic bytes validation</li>
                      {utility.slug === 'png-to-jpg' && <li>White alpha background blending</li>}
                      {utility.slug === 'jpg-to-png' && <li>Lossless PNG byte formatting</li>}
                      <li>Fast in-memory execution</li>
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
                      <>Run {utility.name}</>
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
