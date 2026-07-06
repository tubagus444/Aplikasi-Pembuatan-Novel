import { useState, useEffect } from 'react';
import { CodexEntry } from '@/src/types';
import type { ContinuityChapter, PresenceIndex } from '@/src/lib/continuity';
import { buildPresenceIndexAsync } from '@/src/services/contextEngine';

/**
 * Menghitung PresenceIndex DI WORKER (via buildPresenceIndexAsync) sehingga scan
 * Aho-Corasick lintas-bab tak memblokir main thread. Untuk panel yang auto-recompute
 * (Atlas, Janji Plot) — mengembalikan `null` selagi dihitung.
 *
 * PENTING: `chapters` harus di-memo pemanggil (referensi stabil selama data tak berubah)
 * agar efek tak berulang tiap render. `useLiveQuery` memberi ref baru hanya saat data
 * berubah, jadi mem-memo hasil map/strip-nya sudah cukup.
 */
export function usePresenceIndex(
  chapters: ContinuityChapter[] | null | undefined,
  codexEntries: CodexEntry[]
): PresenceIndex | null {
  const [index, setIndex] = useState<PresenceIndex | null>(null);

  useEffect(() => {
    if (!chapters) {
      setIndex(null);
      return;
    }
    let cancelled = false;
    buildPresenceIndexAsync(chapters, codexEntries)
      .then((idx) => { if (!cancelled) setIndex(idx); })
      .catch((err) => {
        // Worker gagal/timeout → jangan crash panel; kosongkan hasil.
        console.error('buildPresenceIndex (worker) gagal:', err);
        if (!cancelled) setIndex(null);
      });
    return () => { cancelled = true; };
  }, [chapters, codexEntries]);

  return index;
}
