/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pelacak Janji Plot (Chekhov's Gun) — analitik LINTAS-BAB, murni lokal & TANPA AI.
 *
 * Berbeda dari deteksi otomatis (yang menebak-nebak → banyak false-positive), fitur
 * ini adalah PEMBUKUAN: penulis mendeklarasikan "janji" (elemen yang harus terbayar),
 * alat hanya melacak di bab mana elemen itu muncul dan menurunkan status. Karena yang
 * dilacak adalah hal yang dinyatakan penulis, bagian pelacakan akurat/deterministik;
 * keputusan "sudah terbayar atau belum" tetap milik penulis (`PlotPromise.status`).
 *
 * Dua sumber pelacakan kemunculan:
 *   • janji ber-`codexId` → reuse `buildPresenceIndex` (nama + alias entri Codex).
 *   • janji ber-`keywords` (ramalan/misteri non-entitas) → satu scan Aho-Corasick.
 *
 * Bekerja atas TEKS POLOS (HTML sudah di-strip pemanggil), selaras `continuity.ts`.
 */

import { AhoCorasick } from '@/src/lib/ahoCorasick';
import { CodexEntry, PlotPromise } from '@/src/types';
import { buildPresenceIndex, ContinuityChapter } from '@/src/lib/continuity';

/**
 * Status TURUNAN (dihitung, tak disimpan):
 *  - `paid` / `abandoned` — langsung dari niat penulis (`PlotPromise.status`).
 *  - `unseen`  — open, tapi elemennya tak ditemukan di teks bab mana pun
 *                (mungkin tautan/ejaan salah, atau belum ditanam).
 *  - `dormant` — open & tertidur: kemunculan terakhir sudah ≥ ambang bab dari akhir
 *                manuskrip → kandidat janji belum terbayar (ALARM utama).
 *  - `active`  — open & baru saja disebut.
 */
export type PromiseState = 'active' | 'dormant' | 'unseen' | 'paid' | 'abandoned';

export interface PromiseAnalysis {
  promise: PlotPromise;
  state: PromiseState;
  /** Kemunculan per bab (panjang = chapterCount, selaras urutan manuskrip). */
  perChapterCounts: number[];
  /** Indeks bab (0-based) tempat elemen muncul. */
  chapterIndices: number[];
  firstIndex: number | null;
  lastIndex: number | null;
  mentions: number;
  /** Jumlah bab sejak kemunculan terakhir sampai akhir manuskrip (0 bila muncul di bab terakhir). */
  dormancy: number;
}

export interface PromiseReport {
  analyses: PromiseAnalysis[];
  chapterCount: number;
}

export interface PromiseOptions {
  /** Ambang bab tertidur (kemunculan terakhir → akhir manuskrip) agar open → dormant. Default 4. */
  dormancyThreshold?: number;
}

/** Bangun laporan status janji dari bab (terurut) + data Codex. */
export function analyzePromises(
  promises: PlotPromise[],
  chapters: ContinuityChapter[],
  codexEntries: CodexEntry[],
  options?: PromiseOptions,
): PromiseReport {
  const dormancyThreshold = options?.dormancyThreshold ?? 4;
  const chapterCount = chapters.length;

  // Janji ber-codexId: pakai peta kemunculan bersama (nama + alias).
  const presence = buildPresenceIndex(chapters, codexEntries);

  // Janji ber-keywords: satu Aho-Corasick atas semua frasa, ditandai indeks janji.
  const kwKeywords: { word: string; data: number }[] = [];
  promises.forEach((p, i) => {
    if (p.codexId != null) return; // ditangani presence
    for (const kw of p.keywords ?? []) {
      const w = (kw || '').trim();
      if (w.length >= 2) kwKeywords.push({ word: w, data: i });
    }
  });
  const kwAc = kwKeywords.length ? new AhoCorasick(kwKeywords) : null;
  const kwPerChapter: Map<number, number>[] = [];
  if (kwAc) {
    for (const ch of chapters) {
      const counts = new Map<number, number>();
      if (ch.content) {
        for (const m of kwAc.search(ch.content)) {
          const pi = m.data as number;
          counts.set(pi, (counts.get(pi) ?? 0) + 1);
        }
      }
      kwPerChapter.push(counts);
    }
  }

  const analyses: PromiseAnalysis[] = promises.map((promise, pi) => {
    const perChapterCounts = new Array<number>(chapterCount).fill(0);
    for (let c = 0; c < chapterCount; c++) {
      if (promise.codexId != null) {
        perChapterCounts[c] = presence.perChapterCounts[c]?.get(promise.codexId) ?? 0;
      } else {
        perChapterCounts[c] = kwPerChapter[c]?.get(pi) ?? 0;
      }
    }

    const chapterIndices: number[] = [];
    let mentions = 0;
    perChapterCounts.forEach((cnt, idx) => {
      if (cnt > 0) { chapterIndices.push(idx); mentions += cnt; }
    });
    const firstIndex = chapterIndices.length ? chapterIndices[0] : null;
    const lastIndex = chapterIndices.length ? chapterIndices[chapterIndices.length - 1] : null;
    const dormancy = lastIndex == null ? 0 : Math.max(0, chapterCount - 1 - lastIndex);

    let state: PromiseState;
    if (promise.status === 'paid') state = 'paid';
    else if (promise.status === 'abandoned') state = 'abandoned';
    else if (chapterIndices.length === 0) state = 'unseen';
    else if (dormancy >= dormancyThreshold) state = 'dormant';
    else state = 'active';

    return { promise, state, perChapterCounts, chapterIndices, firstIndex, lastIndex, mentions, dormancy };
  });

  return { analyses, chapterCount };
}
