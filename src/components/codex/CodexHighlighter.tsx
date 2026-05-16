/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../../lib/utils';
import { useHighlightedSegments } from '../../hooks/useHighlightedSegments';
import { CodexEntry } from '../../types';

interface CodexHighlighterProps {
  text: string;
  projectId: number;
}

export function CodexHighlighter({ text, projectId }: CodexHighlighterProps) {
  const codex = useLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const renderMatch = useCallback((entry: CodexEntry, part: string, key: string) => (
    <span 
      key={key}
      className="bg-indigo-100 text-indigo-700 border-b border-indigo-300 rounded-sm cursor-help transition-all hover:bg-indigo-200 relative group selection:bg-transparent pointer-events-auto"
    >
      {part}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl z-50 pointer-events-none">
        <span className="block font-bold text-indigo-300 uppercase mb-1">{entry.category}</span>
        <span className="block font-serif italic text-slate-300">{entry.description || 'No description available.'}</span>
      </span>
    </span>
  ), []);

  const highlightedContent = useHighlightedSegments(text, codex || [], renderMatch);

  return (
    <div 
      className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-transparent pointer-events-none select-none h-full w-full"
      style={{ 
        fontFamily: "ui-serif, Georgia, serif", // Match standard serif
        padding: '0',
        margin: '0',
        letterSpacing: 'normal',
        wordSpacing: 'normal',
      }}
    >
      {highlightedContent}
    </div>
  );
}
