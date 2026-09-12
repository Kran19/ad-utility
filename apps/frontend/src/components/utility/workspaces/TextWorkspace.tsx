'use client';

import React, { useState } from 'react';
import { UtilityPublicDto, defaultUtilityRegistry } from '@ad-utility/shared';
import { Type, Copy, Check, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import { trackToolStart, trackToolComplete, trackToolError, trackResultDownload } from '../../../lib/analytics';

interface TextWorkspaceProps {
  utility: UtilityPublicDto;
}

export const TextWorkspace: React.FC<TextWorkspaceProps> = ({ utility }) => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cleaner options
  const [trimWhitespace, setTrimWhitespace] = useState<boolean>(true);
  const [collapseSpaces, setCollapseSpaces] = useState<boolean>(true);
  const [removeEmptyLines, setRemoveEmptyLines] = useState<boolean>(true);
  const [normalizeEndings, setNormalizeEndings] = useState<boolean>(true);
  const [tabSpaces, setTabSpaces] = useState<boolean>(false);

  // Case options
  const [targetCase, setTargetCase] = useState<string>('uppercase');

  const isCaseConverter = utility.slug === 'case-converter';

  const handleExecute = async (overrideCase?: string) => {
    if (!inputText) return;
    setErrorMsg(null);
    setIsLoading(true);

    const startTime = performance.now();
    trackToolStart(utility.slug);

    try {
      // Execute in browser memory using shared code adapter
      const adapter = defaultUtilityRegistry.get(utility.slug);
      if (!adapter) {
        throw new Error(`Execution adapter for "${utility.slug}" not found in browser registry.`);
      }

      let payload: any;
      if (isCaseConverter) {
        payload = {
          text: inputText,
          targetCase: overrideCase || targetCase,
        };
      } else {
        payload = {
          text: inputText,
          options: {
            trimWhitespace,
            collapseSpaces,
            removeEmptyLines,
            normalizeLineEndings: normalizeEndings,
            convertTabsToSpaces: tabSpaces,
          },
        };
      }

      const validated = adapter.validateInput(payload);
      const result: any = await adapter.execute(validated, {
        requestId: `client-${Date.now()}`,
        utilitySlug: utility.slug,
        executionMode: 'LOCAL',
      });

      const convertedText = isCaseConverter ? result.convertedText : result.cleanedText;
      setOutputText(convertedText);

      const elapsed = Math.round(performance.now() - startTime);
      trackToolComplete(utility.slug, elapsed);
    } catch (err: any) {
      const msg = err.message || 'Execution failed';
      setErrorMsg(msg);
      trackToolError(utility.slug, msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    trackResultDownload(utility.slug, { action: 'copy_text' });
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const caseTypes = [
    { key: 'uppercase', label: 'UPPERCASE', desc: 'ALL CAPITAL LETTERS' },
    { key: 'lowercase', label: 'lowercase', desc: 'all small letters' },
    { key: 'title', label: 'Title Case', desc: 'Capitalize Every Word' },
    { key: 'sentence', label: 'Sentence case', desc: 'Capitalize first word' },
    { key: 'camel', label: 'camelCase', desc: 'programmingStyle' },
    { key: 'snake', label: 'snake_case', desc: 'python_style' },
    { key: 'kebab', label: 'kebab-case', desc: 'url-friendly-slug' },
  ];

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
            <Type className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{utility.name} Workspace</h2>
            <p className="text-xs text-slate-500">Client-side instant execution &bull; Complete privacy</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* Options Bar */}
      {isCaseConverter ? (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Choose Target Case
          </label>
          <div className="flex flex-wrap gap-2">
            {caseTypes.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setTargetCase(c.key);
                  handleExecute(c.key);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  targetCase === c.key
                    ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Cleaning Rules
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={(e) => setTrimWhitespace(e.target.checked)}
                className="rounded text-blue-600 accent-blue-600"
              />
              <span>Trim Edges</span>
            </label>
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={collapseSpaces}
                onChange={(e) => setCollapseSpaces(e.target.checked)}
                className="rounded text-blue-600 accent-blue-600"
              />
              <span>Collapse Spaces</span>
            </label>
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={removeEmptyLines}
                onChange={(e) => setRemoveEmptyLines(e.target.checked)}
                className="rounded text-blue-600 accent-blue-600"
              />
              <span>Remove Blank Lines</span>
            </label>
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={normalizeEndings}
                onChange={(e) => setNormalizeEndings(e.target.checked)}
                className="rounded text-blue-600 accent-blue-600"
              />
              <span>Normalize Line Endings</span>
            </label>
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={tabSpaces}
                onChange={(e) => setTabSpaces(e.target.checked)}
                className="rounded text-blue-600 accent-blue-600"
              />
              <span>Tabs to Spaces</span>
            </label>
          </div>
        </div>
      )}

      {/* Dual Pane Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Pane */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">Input Text</span>
            <span className="font-mono">{inputText.length} chars &bull; {inputText.trim().split(/\s+/).filter(Boolean).length} words</span>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste your text here..."
            rows={10}
            className="w-full px-4 py-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
          />
        </div>

        {/* Output Pane */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-slate-700">Transformed Result</span>
            {outputText && (
              <span className="font-mono">{outputText.length} chars &bull; {outputText.trim().split(/\s+/).filter(Boolean).length} words</span>
            )}
          </div>
          <div className="relative">
            <textarea
              readOnly
              value={outputText}
              placeholder="Output will appear here..."
              rows={10}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:outline-none resize-y"
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

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => {
            setInputText('');
            setOutputText('');
            setErrorMsg(null);
          }}
          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          type="button"
          onClick={() => handleExecute()}
          disabled={isLoading || !inputText.trim()}
          className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-bold text-white shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            <>
              <span>Transform Text</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
