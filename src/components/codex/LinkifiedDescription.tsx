import React, { useCallback } from 'react';
import { CodexEntry } from '../../types';
import { useHighlightedSegments } from '../../hooks/useHighlightedSegments';

export function LinkifiedDescription({ text, allEntries }: { text: string; allEntries: CodexEntry[] }) {
  const renderMatch = useCallback((entry: CodexEntry, part: string, key: string) => (
    <span 
      key={key}
      className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 rounded-md cursor-help border border-indigo-100 dark:border-indigo-900/50 relative group transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900"
    >
      {part}
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-slate-900 dark:bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 pointer-events-none border border-slate-700">
        <span className="block font-bold text-indigo-300 uppercase tracking-widest text-[10px] mb-1">{entry.category}</span>
        <span className="block font-serif line-clamp-3 opacity-90 leading-relaxed text-slate-200">{entry.description || 'No description available.'}</span>
      </span>
    </span>
  ), []);

  const highlightedContent = useHighlightedSegments(text, allEntries, renderMatch);

  return <span className="whitespace-pre-wrap">{highlightedContent}</span>;
}
