import { describe, it, expect } from 'vitest';
import { cleanRewriteOutput } from './cleanRewriteOutput';

describe('cleanRewriteOutput', () => {
  it('mengembalikan string kosong untuk input kosong/whitespace', () => {
    expect(cleanRewriteOutput('')).toBe('');
    expect(cleanRewriteOutput('   \n  ')).toBe('');
  });

  it('membiarkan teks bersih apa adanya (sekadar trim)', () => {
    expect(cleanRewriteOutput('  Angin malam berdesir.  ')).toBe('Angin malam berdesir.');
  });

  it('membuang echo label "Rewritten:" di awal', () => {
    expect(cleanRewriteOutput('Rewritten:\nDia berlari menembus hujan.')).toBe(
      'Dia berlari menembus hujan.'
    );
  });

  it('membuang label berbahasa Indonesia (Hasil/Revisi)', () => {
    expect(cleanRewriteOutput('Hasil:\nLangit memerah.')).toBe('Langit memerah.');
    expect(cleanRewriteOutput('Revisi:\nLangit memerah.')).toBe('Langit memerah.');
  });

  it('membuang kalimat pengantar yang diakhiri titik dua', () => {
    expect(
      cleanRewriteOutput('Berikut versi yang sudah diperbaiki:\nMatahari tenggelam perlahan.')
    ).toBe('Matahari tenggelam perlahan.');
    expect(
      cleanRewriteOutput("Here's the rewritten text:\nThe sun set slowly.")
    ).toBe('The sun set slowly.');
  });

  it('membuang code fence pembungkus penuh', () => {
    expect(cleanRewriteOutput('```\nDia tersenyum.\n```')).toBe('Dia tersenyum.');
    expect(cleanRewriteOutput('```markdown\nDia tersenyum.\n```')).toBe('Dia tersenyum.');
  });

  it('membuang tanda kutip pembungkus penuh', () => {
    expect(cleanRewriteOutput('"Hutan itu sunyi."')).toBe('Hutan itu sunyi.');
    expect(cleanRewriteOutput('“Hutan itu sunyi.”')).toBe('Hutan itu sunyi.');
  });

  it('TIDAK memotong kutipan dialog yang sah (kutip muncul di tengah)', () => {
    const dialog = '"Pergi!" teriaknya, lalu ia berbisik "tolong aku".';
    expect(cleanRewriteOutput(dialog)).toBe(dialog);
  });

  it('menangani tumpukan pengantar + label', () => {
    expect(
      cleanRewriteOutput('Tentu, berikut hasilnya:\nRewritten:\nKota itu runtuh.')
    ).toBe('Kota itu runtuh.');
  });
});
