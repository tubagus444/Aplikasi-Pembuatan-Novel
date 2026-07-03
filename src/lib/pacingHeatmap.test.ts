/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTension,
  scoreToLevel,
  levelToScore,
  effectiveTension,
  buildPacingReport,
  ChapterTensionInput,
} from './pacingHeatmap';

describe('estimateTension', () => {
  it('mengembalikan 0 untuk teks kosong', () => {
    expect(estimateTension('')).toBe(0);
    expect(estimateTension('   ')).toBe(0);
  });

  it('memberi skor lebih tinggi pada prosa cepat & tegang daripada deskriptif lambat', () => {
    const tense = '"Lari!" teriaknya. Aku lari. Jantungku berdebar. Dia dekat! "Cepat!"';
    const calm =
      'Matahari terbenam perlahan di balik pegunungan yang jauh sementara angin sore membelai dedaunan pohon ek tua yang telah berdiri di sana selama berabad-abad menyaksikan musim berganti dengan tenang.';
    expect(estimateTension(tense)).toBeGreaterThan(estimateTension(calm));
  });

  it('skor selalu dalam rentang 0–100', () => {
    const s = estimateTension('Dia berlari. Dia jatuh. Dia bangun lagi!');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('deterministik untuk input sama', () => {
    const t = '"Awas!" Dia menoleh. Terlambat.';
    expect(estimateTension(t)).toBe(estimateTension(t));
  });
});

describe('scoreToLevel', () => {
  it('memetakan skor ke pita 1–5', () => {
    expect(scoreToLevel(0)).toBe(1);
    expect(scoreToLevel(19)).toBe(1);
    expect(scoreToLevel(20)).toBe(2);
    expect(scoreToLevel(50)).toBe(3);
    expect(scoreToLevel(79)).toBe(4);
    expect(scoreToLevel(80)).toBe(5);
    expect(scoreToLevel(100)).toBe(5);
  });
});

describe('levelToScore', () => {
  it('mengembalikan pusat pita', () => {
    expect(levelToScore(1)).toBe(10);
    expect(levelToScore(3)).toBe(50);
    expect(levelToScore(5)).toBe(90);
  });

  it('konsisten pulang-pergi dengan scoreToLevel', () => {
    for (const lvl of [1, 2, 3, 4, 5] as const) {
      expect(scoreToLevel(levelToScore(lvl))).toBe(lvl);
    }
  });
});

describe('effectiveTension', () => {
  it('memakai tensi manual bila dideklarasikan (suggested=false)', () => {
    const r = effectiveTension({ content: 'apa saja', tension: 5 });
    expect(r.level).toBe(5);
    expect(r.score).toBe(90);
    expect(r.suggested).toBe(false);
  });

  it('jatuh ke saran turunan bila manual kosong (suggested=true)', () => {
    const r = effectiveTension({ content: 'Dia berjalan pelan menyusuri lorong yang panjang dan sunyi.' });
    expect(r.suggested).toBe(true);
    expect(r.level).toBeGreaterThanOrEqual(1);
    expect(r.level).toBeLessThanOrEqual(5);
    expect(scoreToLevel(r.score)).toBe(r.level);
  });
});

describe('buildPacingReport', () => {
  const mk = (id: number, content: string, tension?: 1 | 2 | 3 | 4 | 5): ChapterTensionInput => ({
    id,
    title: `Bab ${id}`,
    content,
    tension,
  });

  it('menangani manuskrip kosong', () => {
    const r = buildPacingReport([]);
    expect(r.chapterCount).toBe(0);
    expect(r.avgScore).toBe(0);
    expect(r.peak).toBeNull();
    expect(r.quiet).toBeNull();
    expect(r.plateaus).toEqual([]);
    expect(r.valleys).toEqual([]);
  });

  it('menghitung baris, indeks, peak & quiet dari tensi manual', () => {
    const r = buildPacingReport([
      mk(1, 'x', 1),
      mk(2, 'x', 5),
      mk(3, 'x', 3),
    ]);
    expect(r.chapterCount).toBe(3);
    expect(r.chapters[0].index).toBe(0);
    expect(r.peak?.id).toBe(2);
    expect(r.quiet?.id).toBe(1);
    expect(r.suggestedCount).toBe(0);
  });

  it('mendeteksi plateau tegang (≥3 bab beruntun level ≥4)', () => {
    const r = buildPacingReport([
      mk(1, 'x', 2),
      mk(2, 'x', 4),
      mk(3, 'x', 5),
      mk(4, 'x', 4),
      mk(5, 'x', 2),
    ]);
    expect(r.plateaus).toEqual([{ startIndex: 1, endIndex: 3, length: 3 }]);
    expect(r.valleys).toEqual([]);
  });

  it('mendeteksi lembah datar (≥3 bab beruntun level ≤2)', () => {
    const r = buildPacingReport([
      mk(1, 'x', 1),
      mk(2, 'x', 2),
      mk(3, 'x', 1),
      mk(4, 'x', 5),
    ]);
    expect(r.valleys).toEqual([{ startIndex: 0, endIndex: 2, length: 3 }]);
    expect(r.plateaus).toEqual([]);
  });

  it('tidak menandai rentang < 3 bab', () => {
    const r = buildPacingReport([mk(1, 'x', 5), mk(2, 'x', 5), mk(3, 'x', 1)]);
    expect(r.plateaus).toEqual([]);
  });

  it('menghitung run yang menyentuh akhir manuskrip', () => {
    const r = buildPacingReport([mk(1, 'x', 1), mk(2, 'x', 5), mk(3, 'x', 5), mk(4, 'x', 5)]);
    expect(r.plateaus).toEqual([{ startIndex: 1, endIndex: 3, length: 3 }]);
  });

  it('menghitung bab yang masih memakai saran otomatis', () => {
    const r = buildPacingReport([mk(1, 'Dia diam.'), mk(2, 'x', 3)]);
    expect(r.suggestedCount).toBe(1);
    expect(r.chapters[0].suggested).toBe(true);
    expect(r.chapters[1].suggested).toBe(false);
  });
});
