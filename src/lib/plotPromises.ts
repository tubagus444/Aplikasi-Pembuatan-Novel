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

// ── Payoff / reveal (#2) ──────────────────────────────────────────────────────
// Dimensi tambahan: sebuah janji bisa MEMBAYAR (mengungkap) satu entri Codex —
// idealnya entri `hidden` (rahasia penulis, #1). Kita membalik pandangan: per entri
// target, kumpulkan kait (setup) yang menunjuk kepadanya, lalu tandai target yang
// KURANG DITANAM (kait dideklarasikan tapi nyaris tak muncul di prosa). Deterministik
// & nol token — menumpang `mentions` yang sudah dihitung `analyzePromises`.

export type PayoffState =
  | 'unplanted' // ada kait, tapi TAK SATU pun muncul di prosa → alarm: reveal tanpa tanam
  | 'thin'      // sebagian muncul tapi < ambang → foreshadowing tipis
  | 'planted';  // cukup kait yang benar-benar muncul

export interface PayoffAnalysis {
  /** Entri Codex yang dibayar (PlotPromise.payoffCodexId). */
  codexId: number;
  /** Kait (janji) yang menunjuk ke target ini, membawa analisis kemunculannya. */
  setups: PromiseAnalysis[];
  /** setups.length. */
  setupCount: number;
  /** Jumlah kait yang benar-benar muncul di prosa (mentions > 0). */
  seenSetups: number;
  /** Jumlah kait yang ditandai penulis sebagai 'paid'. */
  paidSetups: number;
  state: PayoffState;
}

export interface PayoffOptions {
  /** Minimal kait yang MUNCUL di prosa agar target dianggap cukup ditanam. Default 2. */
  minSeenSetups?: number;
}

/**
 * Kelompokkan analisis janji per `payoffCodexId` → laporan per target. Diurutkan
 * deterministik (state paling genting dulu, lalu codexId) agar stabil di UI & tes.
 */
export function analyzePayoffs(analyses: PromiseAnalysis[], options?: PayoffOptions): PayoffAnalysis[] {
  const minSeen = options?.minSeenSetups ?? 2;

  const byTarget = new Map<number, PromiseAnalysis[]>();
  for (const a of analyses) {
    const target = a.promise.payoffCodexId;
    if (target == null) continue;
    const list = byTarget.get(target) ?? [];
    list.push(a);
    byTarget.set(target, list);
  }

  const result: PayoffAnalysis[] = [];
  for (const [codexId, setups] of byTarget) {
    const seenSetups = setups.filter((s) => s.mentions > 0).length;
    const paidSetups = setups.filter((s) => s.promise.status === 'paid').length;
    const state: PayoffState =
      seenSetups === 0 ? 'unplanted' : seenSetups < minSeen ? 'thin' : 'planted';
    result.push({ codexId, setups, setupCount: setups.length, seenSetups, paidSetups, state });
  }

  const STATE_ORDER: Record<PayoffState, number> = { unplanted: 0, thin: 1, planted: 2 };
  result.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.codexId - b.codexId);
  return result;
}
