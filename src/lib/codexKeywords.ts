/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sumber tunggal pembuatan keyword Aho-Corasick dari entri Codex.
 *
 * Tiga consumer membangun automaton AC atas nama+alias Codex:
 *   - `continuity.ts`  (PresenceIndex untuk analitik lokal)
 *   - `loreGraph.ts`   (scanMentions — backlink deskripsi antar-entri)
 *   - `contextWorker.ts` (filtrasi konteks AI — entri mana yang relevan)
 *
 * Sebelum modul ini, masing-masing menulis loop sendiri dengan aturan filter
 * yang BERBEDA (continuity & loreGraph filter panjang ≥2, worker TIDAK) →
 * hitungan bisa divergen. Fungsi ini menegakkan filter konsisten:
 *   - Abaikan entri tanpa id
 *   - Trim setiap term
 *   - Buang term < 2 karakter (inisial satu huruf hampir selalu false-positive)
 *
 * Data (`T`) generik sehingga tiap consumer bisa melampirkan payload berbeda
 * (id number untuk continuity, objek entry untuk worker, dsb.).
 */

import { CodexEntry } from '@/src/types';

export interface AcKeyword<T> {
  word: string;
  data: T;
}

/** Panjang minimum term agar masuk automaton (filter false-positive inisial). */
const MIN_TERM_LENGTH = 2;

/**
 * Ekstrak keyword Aho-Corasick dari entri Codex (nama + alias) dengan filter
 * konsisten. Pemanggil menyediakan `mapData` untuk menentukan payload `data`
 * yang dilampirkan ke setiap keyword.
 *
 * @param entries Daftar entri Codex.
 * @param mapData Fungsi yang menerima entri + boolean `isAlias` dan mengembalikan
 *                payload `data` untuk keyword tersebut.
 * @returns Array keyword yang siap diumpankan ke `new AhoCorasick(keywords)`.
 */
export function extractCodexAcKeywords<T>(
  entries: CodexEntry[],
  mapData: (entry: CodexEntry, isAlias: boolean) => T,
): AcKeyword<T>[] {
  const keywords: AcKeyword<T>[] = [];
  for (const entry of entries) {
    if (entry.id == null) continue;
    // Nama utama
    const name = (entry.name || '').trim();
    if (name.length >= MIN_TERM_LENGTH) {
      keywords.push({ word: name, data: mapData(entry, false) });
    }
    // Alias
    if (entry.aliases && Array.isArray(entry.aliases)) {
      for (const alias of entry.aliases) {
        const w = (alias || '').trim();
        if (w.length >= MIN_TERM_LENGTH) {
          keywords.push({ word: w, data: mapData(entry, true) });
        }
      }
    }
  }
  return keywords;
}
