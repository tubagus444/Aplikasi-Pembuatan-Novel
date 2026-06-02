import React, { useCallback } from 'react';
import { CodexEntry } from '@/src/types';
import { useHighlightedSegments } from '@/src/hooks/useHighlightedSegments';
import * as Tooltip from '@radix-ui/react-tooltip';

export function LinkifiedDescription({ text, allEntries }: { text: string; allEntries: CodexEntry[] }) {
  const renderMatch = useCallback((entry: CodexEntry, part: string, key: string) => (
    <Tooltip.Provider key={key} delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="inline text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline decoration-indigo-300 dark:decoration-indigo-600 underline-offset-2 transition-all">
            {part}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content 
            className="w-72 max-w-[90vw] z-[9999] bg-white dark:bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            sideOffset={6}
            side="top"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-[9px] bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                {entry.category}
              </span>
            </div>
            <div className="font-serif line-clamp-4 text-xs leading-relaxed opacity-90">
              {entry.description || 'Tidak ada deskripsi.'}
            </div>
            <Tooltip.Arrow className="fill-white dark:fill-slate-900" width={12} height={6} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  ), []);

  const highlightedContent = useHighlightedSegments(text, allEntries, renderMatch);

  return <span className="whitespace-pre-wrap leading-relaxed">{highlightedContent}</span>;
}
