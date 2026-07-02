/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Konsistensi inline — LAPISAN DETERMINISTIK (nol token, nol AI).
 *
 * Menentukan karakter mana yang patut ditandai di bab yang sedang dibuka,
 * murni dari data terstruktur (Timeline + urutan bab). Lapisan AI opsional
 * (Fase 2) menumpang plumbing yang sama untuk kontradiksi yang butuh
 * pemahaman bahasa.
 *
 * Aturan v1 — "muncul sebelum diperkenalkan Timeline":
 *   Bila Timeline menautkan seorang karakter ke sebuah bab (lewat characterIds
 *   + chapterId), bab itu dianggap titik kemunculannya menurut kronologi. Jika
 *   karakter itu disebut di bab yang urutannya LEBIH AWAL dari titik tersebut,
 *   kemunculannya berpotensi terlalu dini. Hanya menyala bila datanya ada,
 *   sehingga tak ada false positive saat Timeline kosong.
 */

import { CodexEntry, TimelineEvent } from '@/src/types';

export interface InlineConsistencyFlag {
  severity: 'high' | 'medium' | 'low';
  message: string;
}

/**
 * Temuan berbasis KUTIPAN dari lapisan AI opsional (Fase 2). Berbeda dari flag
 * deterministik (yang menggarisbawahi nama karakter), ini menggarisbawahi potongan
 * teks verbatim yang dianggap kontradiktif oleh AI.
 */
export interface InlineQuoteFinding {
  /** Potongan teks verbatim dari paragraf yang ditandai. */
  quote: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

/**
 * Temuan salah-eja NAMA KANONIK (Buku Gaya) — deterministik, nol token. Berbeda
 * dari flag (nama benar) & kutipan AI: menggarisbawahi kata yang MIRIP tapi tak
 * persis nama/alias Codex (kandidat typo), dengan saran ejaan. Lihat
 * `src/lib/nameSpelling.ts`.
 */
export interface InlineSpellingFinding {
  /** Kata di teks yang diduga salah eja (casing sesuai kemunculan). */
  word: string;
  /** Ejaan kanonik yang disarankan. */
  suggestion: string;
}

export interface InlineChapterRef {
  id: number;
  order: number;
  title: string;
}

/** Peta codexId → tanda untuk karakter yang patut digarisbawahi di bab ini. */
export function flagCharactersForChapter(
  currentChapterId: number,
  chapters: InlineChapterRef[],
  codexEntries: CodexEntry[],
  timeline: TimelineEvent[],
): Map<number, InlineConsistencyFlag> {
  const flags = new Map<number, InlineConsistencyFlag>();

  const orderById = new Map<number, number>();
  const titleById = new Map<number, string>();
  for (const c of chapters) {
    orderById.set(c.id, c.order);
    titleById.set(c.id, c.title);
  }

  const currentOrder = orderById.get(currentChapterId);
  if (currentOrder == null) return flags;

  // Titik kemunculan paling awal (urutan bab) per karakter menurut Timeline.
  const earliest = new Map<number, { order: number; title: string }>();
  for (const ev of timeline) {
    if (ev.chapterId == null || !ev.characterIds?.length) continue;
    const anchorOrder = orderById.get(ev.chapterId);
    if (anchorOrder == null) continue;
    const anchorTitle = titleById.get(ev.chapterId) ?? '';
    for (const cid of ev.characterIds) {
      const cur = earliest.get(cid);
      if (!cur || anchorOrder < cur.order) earliest.set(cid, { order: anchorOrder, title: anchorTitle });
    }
  }

  for (const e of codexEntries) {
    if (e.id == null || e.category !== 'character') continue;
    const anchor = earliest.get(e.id);
    if (!anchor) continue;
    if (currentOrder < anchor.order) {
      flags.set(e.id, {
        severity: 'medium',
        message: `Menurut Timeline, ${e.name} pertama hadir di "${anchor.title}" (urutan setelah bab ini). Kemunculan di sini mungkin terlalu dini — pastikan disengaja.`,
      });
    }
  }

  return flags;
}
