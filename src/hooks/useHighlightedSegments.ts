import React, { useMemo } from 'react';
import { CodexEntry } from '../types';

export function useHighlightedSegments(
  text: string,
  entries: CodexEntry[],
  renderMatch: (entry: CodexEntry, part: string, key: string) => React.ReactNode
): (string | React.ReactNode)[] {
  return useMemo(() => {
    if (!text || !entries?.length) return [text];
    let segments: (string | React.ReactNode)[] = [text];
    const sorted = [...entries].sort((a, b) => b.name.length - a.name.length);
    sorted.forEach(entry => {
      const names = [entry.name, ...(entry.aliases || [])].filter(Boolean);
      names.forEach(name => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const start = name[0] && /\w/.test(name[0]) ? '\\b' : '';
        const end = name[name.length-1] && /\w/.test(name[name.length-1]) ? '\\b' : '';
        const regex = new RegExp(`(${start}${escaped}${end})`, 'gi');
        const next: (string | React.ReactNode)[] = [];
        let idx = 0;
        segments.forEach((seg, si) => {
          if (typeof seg !== 'string') { next.push(seg); return; }
          seg.split(regex).forEach((part, pi) => {
            if (part.toLowerCase() === name.toLowerCase()) {
              next.push(renderMatch(entry, part, `${entry.id}-${si}-${pi}-${idx++}`));
            } else if (part) {
              next.push(part);
            }
          });
        });
        segments = next;
      });
    });
    return segments;
  }, [text, entries, renderMatch]);
}
