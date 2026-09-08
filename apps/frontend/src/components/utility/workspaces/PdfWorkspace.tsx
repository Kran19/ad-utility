'use client';

import React, { useState, useRef } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import { FileText, Upload, Download, RefreshCw, AlertCircle, Trash2, Plus, Check } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';

interface PdfWorkspaceProps {
  utility: UtilityPublicDto;
}

export const PdfWorkspace: React.FC<PdfWorkspaceProps> = ({ utility }) => {
  // Single file state (for compressor, split, pdf-to-jpg)
  const [singleFile, setSingleFile] = useState<{ file: File; base64: string } | null>(null);

  // Multi file state (for merge)
  const [mergeFiles, setMergeFiles] = useState<Array<{ file: File; base64: string }>>([]);

  // Configuration state
  const [pageRanges, setPageRanges] = useState<string>('1-3');
  const [pdfToJpgPage, setPdfToJpgPage] = useState<'all' | number>('all');
  const [scale, setScale] = useState<number>(1.5);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    dataUrl: string;
    filename: string;
    sizeBytes: number;
    mimeType?: string;
    savingsPercent?: number;
    pageCount?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMerge = utility.slug === 'pdf-merge';
  const isSplit = utility.slug === 'pdf-split';
  const isPdfToJpg = utility.slug === 'pdf-to-jpg';
  const isCompress = utility.slug === 'pdf-compressor';

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

        if (isSplit) {
          payload.pageRanges = pageRanges;
        } else if (isPdfToJpg) {
          payload.page = pdfToJpgPage;
          payload.scale = scale;
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
      setResultData({
        dataUrl: output.dataUrl,
        filename: output.filename || 'processed.pdf',
        sizeBytes: output.sizeBytes || output.compressedSizeBytes || 0,
        mimeType: output.mimeType,
        savingsPercent: output.savingsPercent,
        pageCount: output.pageCount || output.totalPageCount,
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
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{utility.name} Workspace</h2>
            <p className="text-xs text-gray-400">Server stream processing &bull; Privacy protected</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950 text-red-400 border border-red-800/60 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* Upload Zone */}
      {(!isMerge && !singleFile) || (isMerge && mergeFiles.length === 0) ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-800 hover:border-gray-700 bg-gray-950/50 hover:bg-gray-950 rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple={isMerge}
            className="hidden"
            onChange={(e) => handleFilesAdded(e.target.files)}
          />
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-red-400">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-gray-200 mb-1">
            {isMerge ? 'Select multiple PDF files to merge' : 'Drag & drop your PDF file, or browse'}
          </h3>
          <p className="text-xs text-gray-500">
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
                <span className="text-xs font-semibold text-gray-300 uppercase">
                  Files to Merge ({mergeFiles.length} / 10)
                </span>
                {mergeFiles.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
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
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-950 border border-gray-800 text-sm"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="w-6 h-6 rounded-md bg-gray-800 text-gray-400 flex items-center justify-center text-xs font-mono font-bold">
                        {idx + 1}
                      </span>
                      <span className="truncate text-gray-200">{item.file.name}</span>
                      <span className="text-xs text-gray-500">({formatBytes(item.file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMergeFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-500 hover:text-red-400 p-1"
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
              <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-200 truncate max-w-sm">{singleFile.file.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(singleFile.file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSingleFile(null);
                    setResultData(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-medium"
                >
                  Change File
                </button>
              </div>
            )
          )}

          {/* Specific tool options */}
          {isSplit && (
            <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
              <label htmlFor="page-ranges" className="block text-xs font-semibold text-gray-300 uppercase">
                Page Range to Extract
              </label>
              <input
                id="page-ranges"
                type="text"
                value={pageRanges}
                onChange={(e) => setPageRanges(e.target.value)}
                placeholder="e.g. 1-3, 5, 8-10"
                className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-500">
                Specify pages separated by commas or hyphens (e.g. &ldquo;1-3, 5, 8-10&rdquo;).
              </p>
            </div>
          )}

          {isPdfToJpg && (
            <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300 uppercase">Pages to Convert</label>
                <select
                  value={typeof pdfToJpgPage === 'number' ? pdfToJpgPage : 'all'}
                  onChange={(e) => setPdfToJpgPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-200"
                >
                  <option value="all">All Pages (Download ZIP)</option>
                  <option value="1">Page 1 Only (Single JPG)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300 uppercase">Render Scale</label>
                <select
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-200"
                >
                  <option value="1.0">1.0x (Standard - Fast)</option>
                  <option value="1.5">1.5x (High Quality - Recommended)</option>
                  <option value="2.0">2.0x (Ultra Crisp)</option>
                </select>
              </div>
            </div>
          )}

          {/* Result Box */}
          {resultData && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-900/40 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{resultData.filename}</p>
                  <p className="text-xs text-gray-400">
                    Output size: {formatBytes(resultData.sizeBytes)}
                    {typeof resultData.savingsPercent === 'number' && ` • Saved ${resultData.savingsPercent}%`}
                    {resultData.pageCount && ` • ${resultData.pageCount} pages`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          )}

          {/* Action button */}
          {!resultData && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={isLoading || (isMerge && mergeFiles.length < 2)}
              className="w-full px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing PDF...
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
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Operation Error</p>
            <p className="text-red-200 text-xs mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
