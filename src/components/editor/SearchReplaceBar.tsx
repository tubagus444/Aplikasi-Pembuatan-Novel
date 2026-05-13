/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { 
  X, 
  ChevronUp, 
  ChevronDown, 
  CaseSensitive, 
  Regex,
  Replace,
  ReplaceAll
} from 'lucide-react';
import { motion } from 'motion/react';
import { Editor } from '@tiptap/react';
import { cn } from '../../lib/utils';

interface SearchReplaceBarProps {
  editor: Editor | null;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  replaceQuery: string;
  setReplaceQuery: (val: string) => void;
  isCaseSensitive: boolean;
  setIsCaseSensitive: (val: boolean) => void;
  isRegex: boolean;
  setIsRegex: (val: boolean) => void;
  searchStats: { current: number; total: number };
  onClose: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function SearchReplaceBar({
  editor,
  searchQuery,
  setSearchQuery,
  replaceQuery,
  setReplaceQuery,
  isCaseSensitive,
  setIsCaseSensitive,
  isRegex,
  setIsRegex,
  searchStats,
  onClose,
  onReplace,
  onReplaceAll,
  onNext,
  onPrev
}: SearchReplaceBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const hasResults = searchStats.total > 0;
  const noQuery = searchQuery.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-16 right-8 z-50 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 flex flex-col gap-3"
    >
      {/* Row 1: Search */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "w-full h-9 px-3 py-1 bg-slate-50 dark:bg-slate-800/50 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                !hasResults && !noQuery ? "border-red-300 dark:border-red-900 focus:border-red-500" : "border-slate-200 dark:border-slate-700 focus:border-indigo-500"
              )}
            />
            {searchQuery && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 rounded">
                {searchStats.current} / {searchStats.total}
              </span>
            )}
          </div>

          <div className="flex gap-0.5 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={() => setIsCaseSensitive(!isCaseSensitive)}
              className={cn(
                "p-1.5 rounded transition-colors",
                isCaseSensitive ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
              )}
              title="Case Sensitive (Aa)"
            >
              <CaseSensitive size={14} />
            </button>
            <button
              onClick={() => setIsRegex(!isRegex)}
              className={cn(
                "p-1.5 rounded transition-colors",
                isRegex ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
              )}
              title="Gunakan Regex (.*)"
            >
              <Regex size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={onPrev}
              disabled={!hasResults}
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Sebelumnya"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onNext}
              disabled={!hasResults}
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Berikutnya"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Tutup"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800 mx-1" />

      {/* Row 2: Replace */}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Ganti dengan..."
          value={replaceQuery}
          onChange={(e) => setReplaceQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-9 px-3 py-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm transition-all focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />

        <div className="flex gap-2">
          <button
            onClick={onReplace}
            disabled={!hasResults}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <Replace size={14} />
            Ganti
          </button>
          <button
            onClick={onReplaceAll}
            disabled={!hasResults}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none border border-indigo-100 dark:border-indigo-900/50"
          >
            <ReplaceAll size={14} />
            Ganti Semua
          </button>
        </div>
      </div>
    </motion.div>
  );
}
