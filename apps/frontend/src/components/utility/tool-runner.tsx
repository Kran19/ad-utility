'use client';

import React, { useState } from 'react';
import {
  UtilityPublicDto,
  UtilityExecutionResponseDto,
  defaultUtilityRegistry,
} from '@ad-utility/shared';
import dynamic from 'next/dynamic';
import { trackToolStart, trackToolComplete, trackToolError } from '../../lib/analytics';
import { getClientApiUrl } from '../../lib/site-config';

const WorkspaceLoading = () => (
  <div className="w-full h-64 rounded-xl bg-slate-900/50 border border-slate-800 animate-pulse flex items-center justify-center text-slate-500 text-sm">
    Loading utility workspace...
  </div>
);

const ImageWorkspace = dynamic(
  () => import('./workspaces/ImageWorkspace').then((mod) => mod.ImageWorkspace),
  { loading: () => <WorkspaceLoading />, ssr: false },
);

const PdfWorkspace = dynamic(
  () => import('./workspaces/PdfWorkspace').then((mod) => mod.PdfWorkspace),
  { loading: () => <WorkspaceLoading />, ssr: false },
);

const TextWorkspace = dynamic(
  () => import('./workspaces/TextWorkspace').then((mod) => mod.TextWorkspace),
  { loading: () => <WorkspaceLoading />, ssr: false },
);

const AiWorkspace = dynamic(
  () => import('./workspaces/AiWorkspace').then((mod) => mod.AiWorkspace),
  { loading: () => <WorkspaceLoading />, ssr: false },
);

const VideoWorkspace = dynamic(
  () => import('./workspaces/VideoWorkspace').then((mod) => mod.VideoWorkspace),
  { loading: () => <WorkspaceLoading />, ssr: false },
);

const AudioWorkspace = dynamic(
  () => import('./workspaces/AudioWorkspace').then((mod) => mod.AudioWorkspace),
  { loading: () => <WorkspaceLoading />, ssr: false },
);

const QrWorkspace = dynamic(
  () => import('./workspaces/QrWorkspace').then((mod) => mod.QrWorkspace),
  { loading: () => <WorkspaceLoading />, ssr: false },
);

interface ToolRunnerProps {
  utility: UtilityPublicDto;
}

export const ToolRunner: React.FC<ToolRunnerProps> = ({ utility }) => {
  // 1. QR / Barcode Workspace
  if (utility.categorySlug === 'qr-barcode' || ['qr-code-generator', 'barcode-generator', 'qr-code-scanner'].includes(utility.slug)) {
    return <QrWorkspace utility={utility} />;
  }

  // 2. Video Workspace
  if (utility.categorySlug === 'video' || ['video-compressor', 'video-converter', 'video-to-gif', 'video-to-jpg', 'mp4-to-mp3', 'video-trimmer'].includes(utility.slug)) {
    return <VideoWorkspace utility={utility} />;
  }

  // 3. Audio Workspace
  if (utility.categorySlug === 'audio' || ['audio-compressor', 'audio-converter', 'audio-cutter'].includes(utility.slug)) {
    return <AudioWorkspace utility={utility} />;
  }

  // 4. Image Workspace
  if (
    utility.categorySlug === 'image' ||
    ['jpg-to-png', 'png-to-jpg', 'image-compressor', 'image-to-pdf', 'image-resizer', 'image-cropper', 'webp-to-jpg', 'jpg-to-webp', 'png-to-webp'].includes(utility.slug)
  ) {
    return <ImageWorkspace utility={utility} />;
  }

  // 5. PDF Workspace
  if (
    utility.categorySlug === 'pdf' ||
    ['pdf-compressor', 'pdf-merge', 'pdf-split', 'pdf-to-jpg', 'pdf-to-png', 'pdf-to-text', 'pdf-page-extractor', 'pdf-rotator', 'pdf-reorder-pages', 'pdf-watermark', 'pdf-metadata-remover'].includes(utility.slug)
  ) {
    return <PdfWorkspace utility={utility} />;
  }

  // 6. Text Workspace
  if (['text-cleaner', 'case-converter'].includes(utility.slug)) {
    return <TextWorkspace utility={utility} />;
  }

  // 7. AI Workspace
  if (utility.categorySlug === 'ai' || ['ai-humanizer', 'ai-paraphraser', 'ai-grammar-checker'].includes(utility.slug)) {
    return <AiWorkspace utility={utility} />;
  }

  // 8. Generic fallback workspace for reference utilities (json-formatter, word-counter, text-hash, ai-summarizer)
  return <GenericToolWorkspace utility={utility} />;
};

const GenericToolWorkspace: React.FC<ToolRunnerProps> = ({ utility }) => {
  const [inputVal, setInputVal] = useState<string>('');
  const [outputVal, setOutputVal] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<{ executionTimeMs?: number; mode?: string } | null>(null);

  const handleExecute = async () => {
    setErrorMsg(null);
    setOutputVal('');
    setIsLoading(true);
    setStats(null);

    const startTime = performance.now();

    // 1. Emit TOOL_START telemetry
    trackToolStart(utility.slug);

    try {
      if (utility.implementationMode === 'LOCAL') {
        // Execute in browser memory using shared code adapter
        const adapter = defaultUtilityRegistry.get(utility.slug);
        if (!adapter) {
          throw new Error(`Local adapter not registered for slug: ${utility.slug}`);
        }

        const validatedInput = adapter.validateInput({ text: inputVal });
        const result = await adapter.execute(validatedInput, {
          requestId: `client-${Date.now()}`,
          utilitySlug: utility.slug,
          executionMode: 'LOCAL',
        });

        const elapsed = Math.round(performance.now() - startTime);
        setOutputVal(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
        setStats({ executionTimeMs: elapsed, mode: 'LOCAL (Browser)' });

        // 2. Emit TOOL_COMPLETE telemetry
        trackToolComplete(utility.slug, elapsed);
      } else {
        // Execute on server / AI Gateway via backend API
        const apiUrl = getClientApiUrl();
        const res = await fetch(`${apiUrl}/utilities/${utility.slug}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: { text: inputVal } }),
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // Non-JSON response (e.g. 502/504 gateway error)
        }

        if (!res.ok || !data?.success) {
          let message = data?.message || data?.error?.message;
          if (!message) {
            if (res.status === 429) {
              message = 'Rate limit reached. Please wait a few seconds before trying again.';
            } else if (res.status === 503) {
              message = 'Service temporarily unavailable. Please try again shortly.';
            } else if (res.status === 408) {
              message = 'Execution timed out. Please try with smaller input.';
            } else if (res.status === 404) {
              message = 'Utility not found or disabled.';
            } else {
              message = 'An unexpected error occurred during execution. Please try again.';
            }
          }
          throw new Error(message);
        }

        const executionData = data.data as UtilityExecutionResponseDto;
        setOutputVal(
          typeof executionData.result === 'string'
            ? executionData.result
            : JSON.stringify(executionData.result, null, 2),
        );
        setStats({
          executionTimeMs: executionData.executionTimeMs,
          mode: `${executionData.mode} (Server)`,
        });

        // 2. Emit TOOL_COMPLETE telemetry
        trackToolComplete(utility.slug, executionData.executionTimeMs);
      }
    } catch (err: any) {
      let errMsg = err.message || 'An unexpected error occurred during execution';
      if (err.name === 'TypeError' && errMsg.includes('fetch')) {
        errMsg = 'Network connection error. Please check your internet connection.';
      }
      setErrorMsg(errMsg);

      // 3. Emit TOOL_ERROR telemetry
      trackToolError(utility.slug, errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Tool Workspace</h2>
          <p className="text-xs text-gray-400">
            Execution Mode:{' '}
            <span className="inline-block px-2 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800/60 font-mono text-[11px]">
              {utility.implementationMode}
            </span>
          </p>
        </div>
        {stats && (
          <div className="text-right text-xs text-emerald-400 font-mono">
            <span>{stats.executionTimeMs}ms</span> &bull; <span>{stats.mode}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="tool-input" className="block text-sm font-medium text-gray-300">
          Input Text / Data
        </label>
        <textarea
          id="tool-input"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={`Paste or type input for ${utility.name}...`}
          rows={6}
          className="w-full px-4 py-3 rounded-lg bg-gray-950 border border-gray-800 text-gray-100 placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setInputVal('');
            setOutputVal('');
            setErrorMsg(null);
            setStats(null);
          }}
          className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleExecute}
          disabled={isLoading || !inputVal.trim()}
          className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md hover:shadow-blue-500/20 transition-all flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <span>Run {utility.name}</span>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-800/80 text-red-200 text-sm flex items-start gap-3">
          <span className="text-red-400 font-bold">Error:</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {outputVal && (
        <div className="space-y-2 pt-2 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <label htmlFor="tool-output" className="block text-sm font-medium text-gray-300">
              Output Result
            </label>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(outputVal)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
          <pre
            id="tool-output"
            className="w-full p-4 rounded-lg bg-gray-950 border border-gray-800 text-emerald-400 font-mono text-sm overflow-x-auto max-h-[350px]"
          >
            {outputVal}
          </pre>
        </div>
      )}
    </div>
  );
};
