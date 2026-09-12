'use client';

import React, { useState } from 'react';
import { UtilityPublicDto } from '@ad-utility/shared';
import { Sparkles, Copy, Check, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';
import { getClientApiUrl } from '../../../lib/site-config';

interface AiWorkspaceProps {
  utility: UtilityPublicDto;
}

export const AiWorkspace: React.FC<AiWorkspaceProps> = ({ utility }) => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [grammarResult, setGrammarResult] = useState<{
    correctedText: string;
    issueCount: number;
    issues: Array<{ original: string; correction: string; type: string; explanation: string }>;
    overallFeedback: string;
  } | null>(null);

  const [tone, setTone] = useState<string>('standard');
  const [style, setStyle] = useState<string>('standard');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isHumanizer = utility.slug === 'ai-humanizer';
  const isParaphraser = utility.slug === 'ai-paraphraser';
  const isGrammar = utility.slug === 'ai-grammar-checker';

  const maxChars = 50000;

  const handleExecute = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setOutputText('');
    setGrammarResult(null);

    const startTime = performance.now();
    trackToolStart(utility.slug);

    try {
      const apiUrl = getClientApiUrl();
      const payload: any = { text: inputText };

      if (isHumanizer) {
        payload.tone = tone;
      } else if (isParaphraser) {
        payload.style = style;
      }

      const res = await fetch(`${apiUrl}/utilities/${utility.slug}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'AI request failed');
      }

      const result = json.data.result;

      if (isGrammar) {
        setGrammarResult(result);
        setOutputText(result.correctedText || '');
      } else if (isHumanizer) {
        setOutputText(result.humanizedText || '');
      } else if (isParaphraser) {
        setOutputText(result.paraphrasedText || '');
      } else {
        setOutputText(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      }

      const elapsed = Math.round(performance.now() - startTime);
      trackToolComplete(utility.slug, elapsed);
    } catch (err: any) {
      const msg = err.message || 'AI generation failed';
      setErrorMsg(msg);
      trackToolError(utility.slug, msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    trackResultDownload(utility.slug, { action: 'copy_ai_output' });
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tones = [
    { key: 'standard', label: 'Standard', desc: 'Natural & balanced' },
    { key: 'formal', label: 'Formal', desc: 'Professional & polished' },
    { key: 'casual', label: 'Casual', desc: 'Warm & conversational' },
    { key: 'academic', label: 'Academic', desc: 'Scholarly & precise' },
    { key: 'creative', label: 'Creative', desc: 'Expressive & dynamic' },
  ];

  const styles = [
    { key: 'standard', label: 'Standard', desc: 'Clear rephrasing' },
    { key: 'fluent', label: 'Fluent', desc: 'Smooth transitions' },
    { key: 'creative', label: 'Creative', desc: 'Fresh vocabulary' },
    { key: 'concise', label: 'Concise', desc: 'Tight & punchy' },
  ];

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name} Workspace</h2>
            <p className="text-xs text-slate-500">Centralized AI Gateway &bull; Privacy protected &bull; Fast inference</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* Tone/Style Selector */}
      {isHumanizer && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Desired Tone
          </label>
          <div className="flex flex-wrap gap-2">
            {tones.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTone(t.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  tone === t.key
                    ? 'bg-amber-50 border-2 border-amber-500 text-amber-950 shadow-xs ring-2 ring-amber-500/20'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {t.label} <span className="text-[10px] opacity-75 font-normal">({t.desc})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isParaphraser && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Paraphrase Style
          </label>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStyle(s.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  style === s.key
                    ? 'bg-amber-50 border-2 border-amber-500 text-amber-950 shadow-xs ring-2 ring-amber-500/20'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {s.label} <span className="text-[10px] opacity-75 font-normal">({s.desc})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dual Pane Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Pane */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">Input Text</span>
            <span className="font-mono">
              {inputText.length.toLocaleString()} / {maxChars.toLocaleString()} chars
            </span>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, maxChars))}
            placeholder={
              isHumanizer
                ? 'Paste AI draft or text here to improve natural flow...'
                : isParaphraser
                ? 'Paste text to rewrite in a fresh phrasing...'
                : 'Paste text to inspect for grammar and spelling...'
            }
            rows={10}
            className="w-full px-4 py-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
          />
        </div>

        {/* Output Pane */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">
              {isGrammar ? 'Corrected Version' : 'AI Output'}
            </span>
            {outputText && (
              <span className="font-mono font-medium">{outputText.split(/\s+/).filter(Boolean).length} words</span>
            )}
          </div>
          <div className="relative">
            <textarea
              readOnly
              value={outputText}
              placeholder="AI generated result will appear here..."
              rows={10}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none resize-y"
            />
            {outputText && (
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-3 right-3 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-xs transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" /> Copy
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grammar Issue Cards (for ai-grammar-checker) */}
      {isGrammar && grammarResult && (
        <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Detected Issues ({grammarResult.issueCount})
            </span>
            <span className="text-xs text-slate-600 font-medium">{grammarResult.overallFeedback}</span>
          </div>

          {grammarResult.issues && grammarResult.issues.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pt-1">
              {grammarResult.issues.map((iss, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="line-through text-rose-600 font-mono font-medium">{iss.original}</span>
                    <span className="text-emerald-700 font-mono font-bold">&rarr; {iss.correction}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">{iss.explanation}</p>
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 uppercase font-bold border border-slate-200">
                    {iss.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-700 font-bold">✓ No major grammatical issues found!</p>
          )}
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => {
            setInputText('');
            setOutputText('');
            setGrammarResult(null);
            setErrorMsg(null);
          }}
          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          type="button"
          onClick={handleExecute}
          disabled={isLoading || !inputText.trim()}
          className="px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-sm font-bold text-white shadow-md shadow-amber-500/25 flex items-center gap-2 transition-all"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Run {utility.name}</span>
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-800">AI Gateway Error</p>
            <p className="text-rose-700 text-xs mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
