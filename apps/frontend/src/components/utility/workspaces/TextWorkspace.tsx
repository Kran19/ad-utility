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
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Type className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{utility.name} Workspace</h2>
            <p className="text-xs text-gray-400">Client-side instant execution &bull; Complete privacy</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 uppercase">
          {utility.implementationMode}
        </span>
      </div>

      {/* Options Bar */}
      {isCaseConverter ? (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  targetCase === c.key
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-gray-950 text-gray-400 hover:text-gray-200 border border-gray-800 hover:border-gray-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Cleaning Rules
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-300 cursor-pointer hover:border-gray-700">
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={(e) => setTrimWhitespace(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Trim Edges</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-300 cursor-pointer hover:border-gray-700">
              <input
                type="checkbox"
                checked={collapseSpaces}
                onChange={(e) => setCollapseSpaces(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Collapse Spaces</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-300 cursor-pointer hover:border-gray-700">
              <input
                type="checkbox"
                checked={removeEmptyLines}
                onChange={(e) => setRemoveEmptyLines(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Remove Blank Lines</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-300 cursor-pointer hover:border-gray-700">
              <input
                type="checkbox"
                checked={normalizeEndings}
                onChange={(e) => setNormalizeEndings(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Normalize Line Endings</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-300 cursor-pointer hover:border-gray-700">
              <input
                type="checkbox"
                checked={tabSpaces}
                onChange={(e) => setTabSpaces(e.target.checked)}
                className="rounded accent-purple-500"
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
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase text-gray-300">Input Text</span>
            <span>{inputText.length} characters &bull; {inputText.trim().split(/\s+/).filter(Boolean).length} words</span>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste your text here..."
            rows={10}
            className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 text-gray-100 placeholder-gray-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-y"
          />
        </div>

        {/* Output Pane */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase text-gray-300">Transformed Result</span>
            {outputText && (
              <span>{outputText.length} characters &bull; {outputText.trim().split(/\s+/).filter(Boolean).length} words</span>
            )}
          </div>
          <div className="relative">
            <textarea
              readOnly
              value={outputText}
              placeholder="Output will appear here..."
              rows={10}
              className="w-full px-4 py-3 rounded-xl bg-gray-950/80 border border-gray-800 text-purple-300 placeholder-gray-600 text-sm font-mono focus:outline-none resize-y"
            />
            {outputText && (
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 border border-gray-700 flex items-center gap-1.5 shadow-lg transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy
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
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-400 hover:text-gray-200 flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          type="button"
          onClick={() => handleExecute()}
          disabled={isLoading || !inputText.trim()}
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-bold text-white shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all"
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
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
