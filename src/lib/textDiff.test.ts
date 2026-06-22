/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { diffText, summarizeDiff } from './textDiff';

/** Rekonstruksi sisi lama (a) & baru (b) dari segmen untuk verifikasi lossless. */
function reconstruct(segments: ReturnType<typeof diffText>) {
  let a = '';
  let b = '';
  for (const s of segments) {
    if (s.type === 'equal') {
      a += s.value;
      b += s.value;
    } else if (s.type === 'delete') {
      a += s.value;
    } else {
      b += s.value;
    }
  }
  return { a, b };
}

describe('diffText', () => {
  it('teks identik → semua equal', () => {
    const segs = diffText('Halo dunia', 'Halo dunia');
    expect(segs.every((s) => s.type === 'equal')).toBe(true);
    expect(summarizeDiff(segs)).toEqual({ added: 0, removed: 0 });
  });

  it('rekonstruksi lossless untuk perubahan kata', () => {
    const a = 'Dia berjalan pelan menuju pintu.';
    const b = 'Dia berlari cepat menuju gerbang.';
    const segs = diffText(a, b);
    const { a: ra, b: rb } = reconstruct(segs);
    expect(ra).toBe(a);
    expect(rb).toBe(b);
  });

  it('menghitung kata ditambah & dihapus', () => {
    const segs = diffText('satu dua tiga', 'satu tiga empat lima');
    const { added, removed } = summarizeDiff(segs);
    expect(removed).toBe(1); // "dua"
    expect(added).toBe(2); // "empat lima"
  });

  it('penambahan murni di akhir', () => {
    const segs = diffText('Bab satu.', 'Bab satu. Tambahan baru.');
    expect(summarizeDiff(segs)).toEqual({ added: 2, removed: 0 });
  });
});
