import React, { useMemo } from 'react';
import { CodexEntry } from '../types';
import { getCodexRegex } from '../lib/utils';

const segmentRegexCache = new Map<string, RegExp>();

function getSegmentRegex(name: string): RegExp {
  if (!segmentRegexCache.has(name)) {
    segmentRegexCache.set(name, getCodexRegex(name));
  }
  return new RegExp(segmentRegexCache.get(name)!.source, 'gi');
}

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
        const regex = getSegmentRegex(name);
        const next: (string | React.ReactNode)[] = [];
        let idx = 0;
        segments.forEach((seg, si) => {
          if (typeof seg !== 'string') { next.push(seg); return; }
          seg.split(regex).forEach((part, pi) => {
            // Check if part starts with the name, indicating it might have a suffix
            if (part && part.toLowerCase().startsWith(name.toLowerCase())) {
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
