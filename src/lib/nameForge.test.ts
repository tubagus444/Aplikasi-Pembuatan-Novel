/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  generatePhonetic, composeMorphemic, glossName, mulberry32, emptyPalette, PALETTE_PRESETS,
} from './nameForge';
import type { NamePalette } from '@/src/types';

const simple: NamePalette = {
  patterns: ['CV', 'CVC'],
  onsets: ['k', 't'],
  nuclei: ['a', 'o'],
  codas: ['n', 'r'],
  minSyllables: 2,
  maxSyllables: 2,
};

describe('generatePhonetic', () => {
  it('deterministik dengan rng ber-seed', () => {
    const a = generatePhonetic(simple, 5, mulberry32(42));
    const b = generatePhonetic(simple, 5, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('menghasilkan nama kapital dari inventori bunyi (hanya huruf palet)', () => {
    const names = generatePhonetic(simple, 10, mulberry32(1));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(n[0]).toBe(n[0].toUpperCase());
      // hanya huruf dari onset/nukleus/coda (k,t,a,o,n,r) yang boleh muncul
      expect(n.toLowerCase()).toMatch(/^[ktaonr]+$/);
    }
  });

  it('nama unik (case-insensitive)', () => {
    const names = generatePhonetic(simple, 8, mulberry32(7));
    const lower = names.map((n) => n.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('palet tanpa pola/nukleus → array kosong', () => {
    expect(generatePhonetic(emptyPalette(), 5, mulberry32(1))).toEqual([]);
    expect(generatePhonetic({ ...simple, nuclei: [] }, 5, mulberry32(1))).toEqual([]);
  });

  it('count 0 atau negatif → kosong', () => {
    expect(generatePhonetic(simple, 0)).toEqual([]);
  });
});

describe('composeMorphemic', () => {
  const withMorphs: NamePalette = {
    ...emptyPalette(),
    morphemes: [
      { root: 'kel', meaning: 'batu' },
      { root: 'mar', meaning: 'laut' },
      { root: 'dun', meaning: 'benteng' },
    ],
  };

  it('merangkai nama majemuk dari dua akar + membawa maknanya', () => {
    const out = composeMorphemic(withMorphs, 4, mulberry32(3));
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) {
      expect(c.parts).toHaveLength(2);
      // nama = gabungan kedua akar, dikapitalkan
      expect(c.name.toLowerCase()).toBe((c.parts[0].root + c.parts[1].root).toLowerCase());
    }
  });

  it('tanpa leksikon morfem → kosong', () => {
    expect(composeMorphemic(emptyPalette(), 4)).toEqual([]);
  });

  it('deterministik dengan seed', () => {
    expect(composeMorphemic(withMorphs, 4, mulberry32(9))).toEqual(composeMorphemic(withMorphs, 4, mulberry32(9)));
  });
});

describe('glossName', () => {
  const morphs = [
    { root: 'kel', meaning: 'batu' },
    { root: 'mar', meaning: 'laut' },
    { root: 'haven', meaning: 'perlindungan' },
  ];

  it('menguraikan nama tercakup penuh ke akar-akarnya', () => {
    const g = glossName('Kelmar', morphs);
    expect(g.covered).toBe(true);
    expect(g.parts.map((p) => p.root)).toEqual(['kel', 'mar']);
    expect(g.remainder).toBe('');
  });

  it('menandai sisa yang tak dikenal', () => {
    const g = glossName('Kelxyz', morphs);
    expect(g.covered).toBe(false);
    expect(g.parts.map((p) => p.root)).toEqual(['kel']);
    expect(g.remainder).toBe('xyz');
  });

  it('akar terpanjang diprioritaskan (greedy)', () => {
    const g = glossName('Havenkel', morphs);
    expect(g.parts.map((p) => p.root)).toEqual(['haven', 'kel']);
  });

  it('mengabaikan non-huruf & tanpa akar → tak covered', () => {
    const g = glossName("Zzz'", morphs);
    expect(g.parts).toHaveLength(0);
    expect(g.covered).toBe(false);
  });
});

describe('PALETTE_PRESETS', () => {
  it('setiap preset menghasilkan nama valid', () => {
    for (const p of PALETTE_PRESETS) {
      const names = generatePhonetic(p.palette, 3, mulberry32(5));
      expect(names.length).toBeGreaterThan(0);
    }
  });
});
