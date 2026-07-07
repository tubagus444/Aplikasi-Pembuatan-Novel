import { describe, it, expect } from 'vitest';
import { touchLru } from './lruList';

describe('touchLru', () => {
  it('menambah id baru di akhir (paling baru)', () => {
    expect(touchLru([1, 2], 3, 10)).toEqual({ list: [1, 2, 3], evicted: [] });
  });

  it('memindah id yang sudah ada ke paling baru', () => {
    expect(touchLru([1, 2, 3], 1, 10)).toEqual({ list: [2, 3, 1], evicted: [] });
  });

  it('menggusur dari depan saat melebihi cap', () => {
    expect(touchLru([1, 2, 3], 4, 3)).toEqual({ list: [2, 3, 4], evicted: [1] });
  });

  it('menggusur banyak bila jauh melebihi cap', () => {
    expect(touchLru([1, 2, 3, 4, 5], 6, 2)).toEqual({ list: [5, 6], evicted: [1, 2, 3, 4] });
  });

  it('tak menggandakan id yang sudah ada saat cap terlampaui', () => {
    const { list } = touchLru([1, 2, 3], 2, 3);
    expect(list).toEqual([1, 3, 2]);
  });

  it('cap 0 → semua tergusur (dari depan), termasuk id yang baru di-touch', () => {
    expect(touchLru([1], 2, 0)).toEqual({ list: [], evicted: [1, 2] });
  });
});
