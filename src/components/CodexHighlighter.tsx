/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../lib/utils';

interface CodexHighlighterProps {
  text: string;
  projectId: number;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function CodexHighlighter({ text, projectId }: CodexHighlighterProps) {
  const codex = useLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const highlightedContent = useMemo(() => {
    if (!codex || !text) return text;

    let segments: (string | React.ReactNode)[] = [text];

    // Sort by name length descending to catch longer names first
    const sortedCodex = [...codex].sort((a, b) => b.name.length - a.name.length);

    sortedCodex.forEach(entry => {
      const names = [entry.name, ...(entry.aliases || [])].filter(Boolean);
      names.forEach(name => {
        const escapedName = escapeRegExp(name);
        const startChar = name[0];
        const endChar = name[name.length - 1];
        
        const requireStartBoundary = startChar && /\\w/.test(startChar);
        const requireEndBoundary = endChar && /\\w/.test(endChar);
        
        const prefix = requireStartBoundary ? '\\b' : '';
        const suffix = requireEndBoundary ? '\\b' : '';
        
        const regex = new RegExp(`(${prefix}${escapedName}${suffix})`, 'gi');
        
        const newSegments: (string | React.ReactNode)[] = [];
        segments.forEach(segment => {
          if (typeof segment !== 'string') {
            newSegments.push(segment);
            return;
          }

          const parts = segment.split(regex);
          parts.forEach((part, i) => {
            if (part.toLowerCase() === name.toLowerCase()) {
              newSegments.push(
                <span 
                  key={`${entry.id}-${i}`}
                  className="bg-indigo-100 text-indigo-700 border-b border-indigo-300 rounded-sm cursor-help transition-all hover:bg-indigo-200 relative group selection:bg-transparent pointer-events-auto"
                >
                  {part}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl z-50 pointer-events-none">
                    <span className="block font-bold text-indigo-300 uppercase mb-1">{entry.category}</span>
                    <span className="block font-serif italic text-slate-300">{entry.description || 'No description available.'}</span>
                  </span>
                </span>
              );
            } else if (part) {
              newSegments.push(part);
            }
          });
        });
        segments = newSegments;
      });
    });

    return segments;
  }, [codex, text]);

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
