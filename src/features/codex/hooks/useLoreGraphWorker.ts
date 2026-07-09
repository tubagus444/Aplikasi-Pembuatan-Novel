/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hook yang menjalankan `buildLoreGraphView` di Web Worker dengan debounce,
 * memindahkan scan Aho-Corasick + dedup dari main thread. Pola: singleton
 * worker lazy-init, request superseding (hanya hasil terbaru yang diterima).
 *
 * Mengembalikan `{ data, computing }`:
 *   - `data`      — hasil terakhir yang valid (`null` selama belum pernah selesai)
 *   - `computing` — `true` selagi worker masih memproses request terbaru
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LoreGraphView } from '@/src/lib/loreGraph';
import type { CodexEntry, Relationship, PlotPromise } from '@/src/types';
import type { LoreGraphWorkerResponse } from '@/src/workers/loreGraphWorker';

/** Debounce sebelum mengirim data ke worker (ms). */
const DEBOUNCE_MS = 300;

/**
 * Worker di-share antar mount — panel Graf Lore biasanya satu instans,
 * tapi bila di-unmount lalu mount lagi, worker tetap hidup (murah).
 * Dimatikan HANYA saat refcount turun ke 0 (semua consumer unmount).
 */
let sharedWorker: Worker | null = null;
let refCount = 0;

function acquireWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('../../../workers/loreGraphWorker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  refCount++;
  return sharedWorker;
}

function releaseWorker() {
  refCount--;
  if (refCount <= 0 && sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
    refCount = 0;
  }
}

export interface UseLoreGraphWorkerResult {
  data: LoreGraphView | null;
  computing: boolean;
}

/**
 * Jalankan `buildLoreGraphView` di worker dengan debounce.
 *
 * @param entries       Entri Codex (dari useLiveQuery).
 * @param relationships Relasi antar-entri.
 * @param promises      Janji plot.
 * @param sig           Signature stabil — perubahan sig memicu rebuild.
 *                      Dihitung di LoreGraphPanel dan diteruskan ke sini agar
 *                      logika signature tidak terduplikasi.
 */
export function useLoreGraphWorker(
  entries: CodexEntry[] | undefined,
  relationships: Relationship[] | undefined,
  promises: PlotPromise[] | undefined,
  sig: string,
): UseLoreGraphWorkerResult {
  const [data, setData] = useState<LoreGraphView | null>(null);
  const [computing, setComputing] = useState(false);

  // Monoton naik — request lama diabaikan saat hasilnya tiba.
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Handler pesan dari worker — stabil (tidak perlu di-recreate).
  const handleMessage = useCallback((e: MessageEvent<LoreGraphWorkerResponse>) => {
    if (e.data.type === 'GRAPH_VIEW_RESULT') {
      // Abaikan hasil dari request yang sudah di-supersede.
      if (e.data.requestId !== requestIdRef.current) return;
      setData({ nodes: e.data.nodes, links: e.data.links });
      setComputing(false);
    }
  }, []);

  // Lifecycle: acquire/release worker.
  useEffect(() => {
    const w = acquireWorker();
    workerRef.current = w;
    w.addEventListener('message', handleMessage);
    return () => {
      w.removeEventListener('message', handleMessage);
      workerRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      releaseWorker();
    };
  }, [handleMessage]);

  // Kirim data ke worker saat signature berubah (debounced).
  useEffect(() => {
    if (!entries || !relationships || !promises) return;

    // Bersihkan timer debounce sebelumnya (burst edit).
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setComputing(true);

    debounceRef.current = setTimeout(() => {
      const id = ++requestIdRef.current;
      workerRef.current?.postMessage({
        type: 'BUILD_GRAPH_VIEW',
        entries,
        relationships,
        promises,
        requestId: id,
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Dep: `sig` mewakili perubahan data. entries/relationships/promises sengaja
    // TIDAK di deps — mereka berubah referensi tiap emit useLiveQuery tapi sig
    // menjaga agar hanya perubahan ISI yang memicu rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { data, computing };
}
