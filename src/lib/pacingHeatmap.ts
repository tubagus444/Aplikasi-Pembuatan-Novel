/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Heatmap tensi/pacing (#16) — logika murni, deterministik & nol token.
 *
 * Filosofi (searah Janji Plot #2 & Kelengkapan Dunia #11): penulis
 * MENDEKLARASIKAN tensi tiap bab (`Chapter.tension`, 1–5), alat hanya MEMBUKUKAN
 * & meringkas jadi kurva naik-turun alur. Bila belum ditetapkan ("Otomatis"),
 * alat menawarkan SARAN turunan (`estimateTension`) dari sinyal prosa yang sudah
 * dipakai Analitik Prosa (panjang kalimat, rasio dialog, densitas tanda
 * seru/tanya/jeda) — tak disimpan sampai penulis mengonfirmasi.
 *
 * Bekerja atas TEKS POLOS (HTML sudah di-strip pemanggil), selaras `proseAnalysis.ts`
 * & `continuity.ts`. Tak menyentuh jalur AI/ekspor — `tension` murni metadata alur
 * kerja penulis (sengaja beda dari field #17 yang justru masuk KB/ekspor).
 */

import { TensionLevel } from '@/src/types';
import { dialogueRatio } from '@/src/lib/proseAnalysis';

export const TENSION_LABEL: Record<TensionLevel, string> = {
  1: 'Sangat tenang',
  2: 'Tenang',
  3: 'Sedang',
  4: 'Tegang',
  5: 'Sangat tegang',
};

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Ubah skor kontinu 0–100 menjadi tingkat 1–5 (pita 20 poin).
 * <20→1, <40→2, <60→3, <80→4, ≥80→5.
 */
export function scoreToLevel(score: number): TensionLevel {
  if (score < 20) return 1;
  if (score < 40) return 2;
  if (score < 60) return 3;
  if (score < 80) return 4;
  return 5;
}

/** Skor wakil (pusat pita) untuk tingkat manual — agar ikut kurva 0–100. */
export function levelToScore(level: TensionLevel): number {
  return level * 20 - 10; // 1→10, 2→30, 3→50, 4→70, 5→90
}

/**
 * Skor tensi 0–100 turunan dari sinyal prosa (deterministik, nol token).
 * Sinyal & bobot (dipilih agar prosa cepat/tegang naik, prosa lambat/deskriptif turun):
 *   - Panjang kalimat (0.40): makin pendek makin tegang (~8 kata=maks, ~28=min).
 *   - Kalimat pendek (0.15): porsi kalimat ≤6 kata = ritme "punchy".
 *   - Rasio dialog (0.20): pertukaran dialog cenderung mempercepat tempo.
 *   - Tanda urgensi (0.25): "!" "?" "…"/"..." "—"/"--" per 100 kata.
 * Teks kosong → 0.
 */
export function estimateTension(text: string): number {
  const clean = (text || '').trim();
  if (!clean) return 0;

  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  const noEllipsis = clean.replace(/\.{2,}|…/g, ' ');
  const sentences = noEllipsis.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const sentCount = sentences.length || 1;
  const avgLen = wordCount / sentCount;

  // Panjang kalimat → 8 kata atau kurang = 1, 28 kata atau lebih = 0.
  const lenScore = clamp01((28 - avgLen) / (28 - 8));

  // Porsi kalimat pendek (≤6 kata).
  const shortCount = sentences.filter(s => s.split(/\s+/).filter(Boolean).length <= 6).length;
  const shortScore = clamp01(shortCount / sentCount);

  const dlgScore = clamp01(dialogueRatio(clean));

  // Tanda urgensi per 100 kata → 5+ per 100 kata dianggap maksimal.
  const marks = (clean.match(/[!?]|\.\.\.|…|—|--/g) || []).length;
  const punctScore = clamp01((marks / wordCount) * 100 / 5);

  const score = lenScore * 0.4 + shortScore * 0.15 + dlgScore * 0.2 + punctScore * 0.25;
  return Math.round(clamp01(score) * 100);
}

export interface ChapterTensionInput {
  id: number;
  title: string;
  /** Teks polos (tanpa HTML). */
  content: string;
  /** Tensi manual bila dideklarasikan penulis. */
  tension?: TensionLevel;
}

export interface TensionRow {
  id: number;
  title: string;
  /** Indeks bab (0-based, urutan manuskrip). */
  index: number;
  /** Tingkat efektif 1–5 (manual bila ada, jika tidak turunan). */
  level: TensionLevel;
  /** Skor efektif 0–100 (untuk kurva). */
  score: number;
  /** true bila `level` berasal dari saran turunan (belum dideklarasikan). */
  suggested: boolean;
  wordCount: number;
}

/**
 * Tensi efektif satu bab: nilai manual bila ada, jika tidak saran turunan.
 * `suggested: true` menandai masih tebakan (belum dideklarasikan penulis).
 */
export function effectiveTension(chapter: Pick<ChapterTensionInput, 'content' | 'tension'>): {
  level: TensionLevel;
  score: number;
  suggested: boolean;
} {
  if (chapter.tension) {
    return { level: chapter.tension, score: levelToScore(chapter.tension), suggested: false };
  }
  const score = estimateTension(chapter.content);
  return { level: scoreToLevel(score), suggested: true, score };
}

/** Rentang bab berurutan yang membentuk sebuah pola. */
export interface TensionRun {
  startIndex: number;
  endIndex: number;
  length: number;
}

export interface PacingReport {
  chapters: TensionRow[];
  chapterCount: number;
  /** Rata-rata skor tensi seluruh naskah (0–100). */
  avgScore: number;
  /** Bab berskor tertinggi (klimaks kandidat). null bila tak ada bab. */
  peak: TensionRow | null;
  /** Bab berskor terendah (jeda kandidat). null bila tak ada bab. */
  quiet: TensionRow | null;
  /** Berapa banyak bab masih memakai saran otomatis (belum dideklarasikan). */
  suggestedCount: number;
  /** Rentang ≥3 bab beruntun bertensi tinggi (level ≥4) → risiko pembaca jenuh. */
  plateaus: TensionRun[];
  /** Rentang ≥3 bab beruntun bertensi rendah (level ≤2) → alur melandai. */
  valleys: TensionRun[];
}

const RUN_MIN = 3;

/** Kumpulkan rentang beruntun bab yang memenuhi `pred` dengan panjang ≥ RUN_MIN. */
function collectRuns(rows: TensionRow[], pred: (r: TensionRow) => boolean): TensionRun[] {
  const runs: TensionRun[] = [];
  let start = -1;
  for (let i = 0; i < rows.length; i++) {
    if (pred(rows[i])) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      if (i - start >= RUN_MIN) runs.push({ startIndex: start, endIndex: i - 1, length: i - start });
      start = -1;
    }
  }
  if (start !== -1 && rows.length - start >= RUN_MIN) {
    runs.push({ startIndex: start, endIndex: rows.length - 1, length: rows.length - start });
  }
  return runs;
}

/**
 * Bangun laporan pacing dari bab (teks polos, terurut manuskrip). Menurunkan
 * kurva tensi per-bab + dua pola makro: plateau tegang (jenuh) & lembah datar
 * (melandai). Deterministik & nol token.
 */
export function buildPacingReport(chapters: ChapterTensionInput[]): PacingReport {
  const rows: TensionRow[] = chapters.map((ch, index) => {
    const { level, score, suggested } = effectiveTension(ch);
    const wordCount = (ch.content || '').split(/\s+/).filter(Boolean).length;
    return { id: ch.id, title: ch.title, index, level, score, suggested, wordCount };
  });

  let peak: TensionRow | null = null;
  let quiet: TensionRow | null = null;
  let sumScore = 0;
  let suggestedCount = 0;
  for (const r of rows) {
    sumScore += r.score;
    if (r.suggested) suggestedCount += 1;
    if (!peak || r.score > peak.score) peak = r;
    if (!quiet || r.score < quiet.score) quiet = r;
  }

  return {
    chapters: rows,
    chapterCount: rows.length,
    avgScore: rows.length ? Math.round(sumScore / rows.length) : 0,
    peak,
    quiet,
    suggestedCount,
    plateaus: collectRuns(rows, r => r.level >= 4),
    valleys: collectRuns(rows, r => r.level <= 2),
  };
}
