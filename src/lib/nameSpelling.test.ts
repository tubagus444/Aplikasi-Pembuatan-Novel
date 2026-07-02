/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { editDistance, collectCanonicalTerms, findSpellingIssues } from './nameSpelling';

describe('editDistance (Damerau-Levenshtein/OSA)', () => {
  it('menghitung substitusi tunggal', () => {
    expect(editDistance('aetherya', 'aetheria')).toBe(1);
  });
  it('menghitung transposisi bersebelahan sebagai 1', () => {
    expect(editDistance('aehteria', 'aetheria')).toBe(1);
  });
  it('mengembalikan 0 untuk identik', () => {
    expect(editDistance('aetheria', 'aetheria')).toBe(0);
  });
  it('berhenti awal di atas max', () => {
    expect(editDistance('abcdef', 'zzzzzz', 2)).toBeGreaterThan(2);
  });
});

describe('collectCanonicalTerms', () => {
  it('memecah nama multi-kata & menyaring kata pendek/non-kapital', () => {
    const terms = collectCanonicalTerms([
      { name: 'Kota Aetheria', aliases: ['Sang Kota', 'kecil'] },
    ]);
    expect(terms).toContain('Aetheria');
    expect(terms).toContain('Kota');
    expect(terms).toContain('Sang');
    expect(terms).not.toContain('kecil'); // non-kapital → dibuang
  });
  it('deduplikasi lintas nama & alias (case-insensitive)', () => {
    const terms = collectCanonicalTerms([
      { name: 'Aetheria' },
      { name: 'aetheria', aliases: ['Aetheria'] },
    ]);
    expect(terms.filter(t => t.toLowerCase() === 'aetheria')).toHaveLength(1);
  });
});

describe('findSpellingIssues', () => {
  const terms = ['Aetheria', 'Kaelen'];

  it('menandai salah-eja substitusi', () => {
    const issues = findSpellingIssues('Dia menuju Aetherya pagi itu.', terms);
    expect(issues).toEqual([{ word: 'Aetherya', suggestion: 'Aetheria' }]);
  });

  it('menandai salah-eja transposisi', () => {
    const issues = findSpellingIssues('Gerbang Aehteria terbuka.', terms);
    expect(issues).toEqual([{ word: 'Aehteria', suggestion: 'Aetheria' }]);
  });

  it('TIDAK menandai ejaan yang benar', () => {
    expect(findSpellingIssues('Aetheria dan Kaelen tiba.', terms)).toEqual([]);
  });

  it('TIDAK menandai kata biasa non-kapital', () => {
    // Kata umum non-kapital tak pernah diperiksa (guard proper-noun), walau mirip.
    expect(findSpellingIssues('dia berkata pelan tentang kota itu.', terms)).toEqual([]);
  });

  it('TIDAK menandai kata pendek (<4 huruf)', () => {
    // "Ran" mirip "Rani" tetapi hanya 3 huruf → di bawah MIN_LEN, dilewati.
    expect(findSpellingIssues('Ran pergi.', ['Rani'])).toEqual([]);
  });

  it('melewati kandidat AMBIGU (≥2 istilah dalam ambang)', () => {
    // "Baros" berjarak 1 dari "Baris" dan "Boros" → ambigu → tak ditandai
    const issues = findSpellingIssues('Nama Baros disebut.', ['Baris', 'Boros']);
    expect(issues).toEqual([]);
  });

  it('melewati kata yang sering muncul (kemungkinan istilah sah)', () => {
    const text = 'Aetherya Aetherya Aetherya Aetherya berkilau.'; // 4x → di atas ambang
    expect(findSpellingIssues(text, terms)).toEqual([]);
  });

  it('satu temuan per kata unik walau muncul beberapa kali (di bawah ambang)', () => {
    const text = 'Aetherya lalu Aetherya lagi.'; // 2x
    const issues = findSpellingIssues(text, terms);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({ word: 'Aetherya', suggestion: 'Aetheria' });
  });
});
