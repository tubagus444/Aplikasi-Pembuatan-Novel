/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bengkel Nama (#3) — generator & glos nama patuh PALET FONOTAKTIK per-faksi.
 * Murni, deterministik, nol token, nol AI (seperti `nameSpelling.ts`/`proseAnalysis.ts`).
 *
 * Tiga kemampuan, semua dari satu `NamePalette` (disimpan di `CodexEntry.namePalette`):
 *   • generatePhonetic — rangkai suku kata dari inventori bunyi + pola suku kata.
 *   • composeMorphemic — rangkai nama majemuk bermakna dari leksikon morfem (akar→makna).
 *   • glossName — uraikan sebuah nama ke akar-akar yang dikenal (cek makna/konsistensi).
 *
 * Fungsi generasi menerima `rng` opsional (default Math.random) agar bisa diuji
 * deterministik lewat PRNG ber-seed (`mulberry32`).
 */

import type { Morpheme, NamePalette } from '@/src/types';
export type { Morpheme, NamePalette } from '@/src/types';

export interface ComposedName {
  name: string;
  parts: Morpheme[];
}

export interface GlossResult {
  name: string;
  /** Akar yang terdeteksi (urut dari awal nama). */
  parts: Morpheme[];
  /** true bila SELURUH nama tercakup akar yang dikenal. */
  covered: boolean;
  /** Sisa huruf yang tak cocok akar mana pun (bila tak covered). */
  remainder: string;
}

/** PRNG ber-seed (mulberry32) — dipakai tes untuk output deterministik. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function capitalize(raw: string): string {
  if (!raw) return raw;
  return raw[0].toUpperCase() + raw.slice(1);
}

/** Perluas satu pola suku kata (mis. "CVC") menjadi bunyi memakai palet. */
function expandPattern(pattern: string, p: NamePalette, rng: () => number): string {
  let seenVowel = false;
  let out = '';
  for (const ch of pattern) {
    if (ch === 'V' || ch === 'v') {
      if (p.nuclei.length) out += pick(p.nuclei, rng);
      seenVowel = true;
    } else if (ch === 'C' || ch === 'c') {
      if (!seenVowel) {
        if (p.onsets.length) out += pick(p.onsets, rng);
      } else if (p.codas.length) {
        out += pick(p.codas, rng);
      }
    }
  }
  return out;
}

/**
 * Hasilkan `count` nama fonetik dari palet. Deterministik bila `rng` ber-seed.
 * Mengembalikan nama unik (case-insensitive), melewati hasil terlalu pendek.
 */
export function generatePhonetic(palette: NamePalette, count: number, rng: () => number = Math.random): string[] {
  const patterns = (palette.patterns ?? []).filter((s) => /[VvCc]/.test(s));
  if (!patterns.length || !(palette.nuclei ?? []).length || count <= 0) return [];

  const minS = Math.max(1, palette.minSyllables ?? 2);
  const maxS = Math.max(minS, palette.maxSyllables ?? 3);

  const out: string[] = [];
  const seen = new Set<string>();
  const cap = count * 40 + 100; // batas percobaan agar tak loop bila ruang nama sempit
  let attempts = 0;

  while (out.length < count && attempts < cap) {
    attempts++;
    const syllables = minS + Math.floor(rng() * (maxS - minS + 1));
    let raw = '';
    for (let s = 0; s < syllables; s++) raw += expandPattern(pick(patterns, rng), palette, rng);
    if (raw.length < 2) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(capitalize(raw));
  }
  return out;
}

/**
 * Rangkai `count` nama majemuk dari leksikon morfem (mis. akar "iron"+"haven").
 * Setiap hasil membawa `parts` agar maknanya bisa ditampilkan. Deterministik bila
 * `rng` ber-seed. Menghindari mengulang akar yang sama bersebelahan bila mungkin.
 */
export function composeMorphemic(palette: NamePalette, count: number, rng: () => number = Math.random): ComposedName[] {
  const morphs = (palette.morphemes ?? []).filter((m) => m.root?.trim());
  if (!morphs.length || count <= 0) return [];

  const out: ComposedName[] = [];
  const seen = new Set<string>();
  const cap = count * 40 + 100;
  let attempts = 0;

  while (out.length < count && attempts < cap) {
    attempts++;
    const a = pick(morphs, rng);
    let b = pick(morphs, rng);
    if (morphs.length > 1 && b.root === a.root) b = pick(morphs, rng);
    const raw = (a.root + b.root).toLowerCase();
    if (raw.length < 2) continue;
    const key = raw;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: capitalize(raw), parts: [a, b] });
  }
  return out;
}

const LETTERS_RE = /[^\p{L}]/gu;

/**
 * Uraikan `name` ke akar-akar yang dikenal (greedy, akar terpanjang lebih dulu).
 * Berguna untuk cek makna/konsistensi toponimi. Nol token.
 */
export function glossName(name: string, morphemes: Morpheme[]): GlossResult {
  const lower = (name ?? '').toLowerCase().replace(LETTERS_RE, '');
  const roots = (morphemes ?? [])
    .filter((m) => m.root?.trim())
    .map((m) => ({ root: m.root.toLowerCase(), meaning: m.meaning, orig: m }))
    .sort((a, b) => b.root.length - a.root.length);

  const parts: Morpheme[] = [];
  let rem = lower;
  let progressed = true;
  while (rem.length && progressed) {
    progressed = false;
    for (const r of roots) {
      if (r.root && rem.startsWith(r.root)) {
        parts.push({ root: r.orig.root, meaning: r.meaning });
        rem = rem.slice(r.root.length);
        progressed = true;
        break;
      }
    }
  }

  return { name, parts, covered: rem.length === 0 && parts.length > 0, remainder: rem };
}

/** Preset palet siap-pakai agar penulis tak mulai dari kosong. */
export const PALETTE_PRESETS: { id: string; label: string; palette: NamePalette }[] = [
  {
    id: 'flowing',
    label: 'Mengalir (vokal & liquid)',
    palette: {
      patterns: ['CV', 'CVC', 'V', 'VC'],
      onsets: ['l', 'r', 'm', 'n', 'v', 's', 'th', 'sh', 'ael', 'ly'],
      nuclei: ['a', 'e', 'i', 'ae', 'ia', 'io', 'ei'],
      codas: ['n', 'l', 'r', '', '', 'th'],
      minSyllables: 2,
      maxSyllables: 3,
    },
  },
  {
    id: 'harsh',
    label: 'Keras (stop & gugus konsonan)',
    palette: {
      patterns: ['CVC', 'CCVC', 'CVCC'],
      onsets: ['k', 't', 'd', 'g', 'dr', 'gr', 'kr', 'br', 'skr'],
      nuclei: ['a', 'o', 'u', 'au', 'ar'],
      codas: ['k', 't', 'g', 'rk', 'rd', 'kt', ''],
      minSyllables: 2,
      maxSyllables: 3,
    },
  },
  {
    id: 'morphemic',
    label: 'Majemuk bermakna (toponimi)',
    palette: {
      patterns: ['CVC'],
      onsets: ['k', 'd', 'v'],
      nuclei: ['a', 'e', 'o'],
      codas: ['r', 'n', 'l'],
      minSyllables: 2,
      maxSyllables: 2,
      morphemes: [
        { root: 'kel', meaning: 'batu' },
        { root: 'mar', meaning: 'laut' },
        { root: 'dun', meaning: 'benteng' },
        { root: 'vale', meaning: 'lembah' },
        { root: 'thorn', meaning: 'bahaya' },
        { root: 'haven', meaning: 'perlindungan' },
      ],
    },
  },
];

/** Palet kosong untuk mulai menyusun manual. */
export function emptyPalette(): NamePalette {
  return { patterns: [], onsets: [], nuclei: [], codas: [], minSyllables: 2, maxSyllables: 3, morphemes: [] };
}
