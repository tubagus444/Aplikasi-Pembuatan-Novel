/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { PacingReport } from '@/src/lib/pacingHeatmap';
import { buildPacingReportAsync } from '@/src/services/contextEngine';
import { PlainChapter } from '@/src/hooks/usePlainChapters';

export function usePacingReport(
  projectId: number,
  chapters: PlainChapter[] | undefined
) {
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<PacingReport | null>(null);

  const scan = useCallback(async () => {
    if (!chapters) return null;
    setScanning(true);
    setReport(null);
    try {
      const result = await buildPacingReportAsync(chapters);
      setReport(result);
      return result;
    } finally {
      setScanning(false);
    }
  }, [chapters]);

  useEffect(() => {
    scan();
  }, [scan]);

  return { scanning, report, setReport, scan };
}
