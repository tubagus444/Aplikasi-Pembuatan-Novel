/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Buku Gaya — deteksi salah-eja NAMA/ISTILAH KANONIK (nol token, nol AI).
 *
 * Kebalikan dari Aho-Corasick/PassiveCodexHighlight yang menyorot kata yang
 * PERSIS cocok nama/alias Codex: fungsi ini menandai kata yang MIRIP tapi TIDAK
 * persis — kandidat salah-ketik nama dunia (mis. "Aetherya" → "Aetheria") yang
 * lolos dari spell-checker browser karena bukan kata kamus.
 *
 * Murni & deterministik (seperti `continuity.ts` / `proseAnalysis.ts`), sehingga
 * mudah diuji. Efek ke editor dilakukan pemanggil (`useEditorSpelling`).
 *
 * Falsafah: PRESISI di atas kelengkapan. Lebih baik melewatkan sebagian typo
 * daripada menodai prosa dengan garis bawah palsu. Karena itu ada beberapa guard
 * ketat (lihat di bawah) — nama-diri hampir selalu berhuruf kapital, jadi kita
 * hanya memeriksa token kapital, mensyaratkan huruf pertama sama, membatasi jarak
 * edit, dan melewati kata yang sering muncul (kemungkinan istilah sah yang belum
 * dimasukkan ke Codex).
 */

export interface SpellingIssue {
  /** Kata di teks yang diduga salah eja (casing sesuai kemunculan). */
  word: string;
  /** Ejaan kanonik yang disarankan. */
  suggestion: string;
}

// --- Parameter guard (disetel untuk minim false-positive) ---
const MIN_LEN = 4;        // token lebih pendek terlalu rawan salah tanda
const FREQ_SKIP = 4;      // kata yang muncul ≥ ini kali → anggap istilah sah, lewati
const MAX_ISSUES = 60;    // batas atas jumlah temuan per bab (jaga performa/UI)

/** Ambang jarak edit menurut panjang kata: makin panjang, makin toleran. */
function distanceThreshold(len: number): number {
  return len >= 8 ? 2 : 1;
}

/**
 * Jarak edit Damerau-Levenshtein (optimal string alignment) — menghitung
 * substitusi/insersi/delesi PLUS transposisi huruf bersebelahan ("Aehteria").
 * Berhenti awal bila jarak minimum baris sudah melewati `max` (hemat).
 */
export function editDistance(a: string, b: string, max = 2): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prevPrev: number[] = [];
  let prev: number[] = new Array(lb + 1);
  let curr: number[] = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        prev[j] + 1,      // delesi
        curr[j - 1] + 1,  // insersi
        prev[j - 1] + cost, // substitusi
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, prevPrev[j - 2] + 1); // transposisi
      }
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > max) return max + 1; // tak mungkin ≤ max lagi
    prevPrev = prev;
    prev = curr;
    curr = new Array(lb + 1);
  }
  return prev[lb];
}

/** Apakah huruf pertama string adalah huruf kapital (bukan angka/simbol). */
function startsUpper(w: string): boolean {
  const c = w[0];
  return !!c && c === c.toUpperCase() && c !== c.toLowerCase();
}

const WORD_RE = /[\p{L}][\p{L}'’-]*/gu;

/**
 * Kumpulkan istilah kanonik dari entri Codex: nama + alias, dipecah per kata,
 * disaring ke kata proper (kapital, panjang ≥ MIN_LEN). Multi-kata ("Kota
 * Aetheria") ikut menyumbang tiap kata → "Aetheria" tetap dikenali kanonik.
 */
export function collectCanonicalTerms(
  entries: { name?: string; aliases?: string[] }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const parts = raw.match(WORD_RE);
    if (!parts) return;
    for (const p of parts) {
      if (p.length < MIN_LEN || !startsUpper(p)) continue;
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  };
  for (const e of entries) {
    add(e.name);
    if (e.aliases) for (const a of e.aliases) add(a);
  }
  return out;
}

/**
 * Cari kandidat salah-eja nama di `text` terhadap daftar istilah kanonik.
 * Mengembalikan satu temuan per kata unik yang salah (pemanggil menggarisbawahi
 * semua kemunculannya). Nol token.
 */
export function findSpellingIssues(text: string, terms: string[]): SpellingIssue[] {
  if (!text || terms.length === 0) return [];

  // Bentuk kanonik (lower) untuk cek "ejaan benar" cepat + bucket per huruf awal.
  const known = new Set<string>();
  const byFirst = new Map<string, string[]>(); // huruf-awal-lower → istilah asli
  for (const t of terms) {
    const lower = t.toLowerCase();
    known.add(lower);
    const f = lower[0];
    let bucket = byFirst.get(f);
    if (!bucket) { bucket = []; byFirst.set(f, bucket); }
    bucket.push(t);
  }

  // Tokenisasi + hitung frekuensi (untuk guard kata sering-muncul).
  const tokens = text.match(WORD_RE) ?? [];
  const freq = new Map<string, number>();
  for (const tk of tokens) freq.set(tk, (freq.get(tk) ?? 0) + 1);

  const issues: SpellingIssue[] = [];
  const emitted = new Set<string>(); // kata (case-sensitive) yang sudah ditandai

  for (const [word, count] of freq) {
    if (issues.length >= MAX_ISSUES) break;
    if (word.length < MIN_LEN) continue;
    if (!startsUpper(word)) continue;          // hanya nama-diri (kapital)
    if (count >= FREQ_SKIP) continue;          // sering muncul → kemungkinan istilah sah
    const lower = word.toLowerCase();
    if (known.has(lower)) continue;            // ejaan benar → jangan tandai
    if (emitted.has(word)) continue;

    const bucket = byFirst.get(lower[0]);      // huruf pertama harus sama
    if (!bucket) continue;

    const max = distanceThreshold(word.length);
    const matches = new Set<string>();         // istilah-lower dalam ambang
    let suggestion = '';
    let best = max + 1;
    for (const term of bucket) {
      if (Math.abs(term.length - word.length) > max) continue;
      const d = editDistance(lower, term.toLowerCase(), max);
      if (d >= 1 && d <= max) {
        matches.add(term.toLowerCase());
        if (d < best) { best = d; suggestion = term; }
      }
    }

    // Tepat satu kandidat kanonik → saran jelas. Ambigu (≥2) → lewati (jangan menebak).
    if (matches.size === 1 && suggestion) {
      issues.push({ word, suggestion });
      emitted.add(word);
    }
  }

  return issues;
}
