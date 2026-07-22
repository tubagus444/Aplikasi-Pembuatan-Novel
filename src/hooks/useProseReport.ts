/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { ProseLanguage, ProseReport } from '@/src/lib/proseAnalysis';
import { buildProseReportAsync } from '@/src/services/contextEngine';
import { PlainChapter } from '@/src/hooks/usePlainChapters';
import { CodexEntry } from '@/src/types';

function buildCodexStoplist(entries: CodexEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    for (const term of [e.name, ...(e.aliases || [])]) {
      for (const w of (term || '').toLowerCase().split(/[^a-z]+/)) {
        if (w.length >= 2) set.add(w);
      }
    }
  }
  return set;
}

export function useProseReport(
  projectId: number,
  chapters: PlainChapter[] | undefined,
  codexEntries: CodexEntry[],
  language: ProseLanguage
) {
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<ProseReport | null>(null);

  const scan = useCallback(async () => {
    if (!chapters) return null;
    setScanning(true);
    setReport(null);
    try {
      const exclude = buildCodexStoplist(codexEntries);
      const result = await buildProseReportAsync(chapters, language, exclude);
      setReport(result);
      return result;
    } finally {
      setScanning(false);
    }
  }, [chapters, codexEntries, language]);

  return { scanning, report, setReport, scan };
}
