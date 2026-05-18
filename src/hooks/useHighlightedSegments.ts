import React, { useMemo } from 'react';
import { CodexEntry } from '@/src/types';
import { getCodexRegex } from '@/src/lib/utils';

const segmentRegexCache = new Map<string, RegExp>();

export function useHighlightedSegments(
  text: string,
  entries: CodexEntry[],
  renderMatch: (entry: CodexEntry, part: string, key: string) => React.ReactNode
): (string | React.ReactNode)[] {
  // Clear cache if entries change (names or aliases)
  const entriesHash = useMemo(() => 
    entries.map(e => `${e.name}:${(e.aliases || []).join(',')}`).join('|'),
    [entries]
  );

  React.useEffect(() => {
    segmentRegexCache.clear();
  }, [entriesHash]);

  return useMemo(() => {
    if (!text || !entries?.length) return [text];
    let segments: (string | React.ReactNode)[] = [text];
    const sorted = [...entries].sort((a, b) => b.name.length - a.name.length);
    sorted.forEach(entry => {
      const names = [entry.name, ...(entry.aliases || [])].filter(Boolean);
      names.forEach(name => {
        if (!segmentRegexCache.has(name)) {
          segmentRegexCache.set(name, getCodexRegex(name));
        }
        const regex = new RegExp(segmentRegexCache.get(name)!.source, 'gi');
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
