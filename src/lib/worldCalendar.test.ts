/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  daysInYear, daysInMonth, dayOfYear, compareDate, dayOfWeek, weekdayOfFirst,
  addDays, daysBetween, seasonForMonth, formatDate, formatDateRange,
  eraLabel, eraAbbr, calendarPreset, emptyCalendar,
} from './worldCalendar';
import type { WorldCalendar } from '@/src/types';

const fantasy = calendarPreset('fantasy'); // 8 bulan (321 hari/thn), 6 weekday, 3 era
const greg = calendarPreset('gregorian');

describe('daysInYear / daysInMonth / dayOfYear', () => {
  it('menjumlahkan panjang semua bulan', () => {
    expect(daysInYear(fantasy)).toBe(321); // 40+36+42+45+40+38+36+44
    expect(daysInYear(greg)).toBe(365);
  });

  it('daysInMonth 1-based, 0 di luar rentang', () => {
    expect(daysInMonth(fantasy, 1)).toBe(40);
    expect(daysInMonth(fantasy, 4)).toBe(45);
    expect(daysInMonth(fantasy, 99)).toBe(0);
  });

  it('dayOfYear menjumlahkan bulan sebelumnya + hari', () => {
    expect(dayOfYear(fantasy, { era: 0, year: 1, month: 1, day: 1 })).toBe(1);
    expect(dayOfYear(fantasy, { era: 0, year: 1, month: 4, day: 12 })).toBe(130); // 40+36+42 + 12
  });
});

describe('compareDate', () => {
  it('mengurut era → year → month → day', () => {
    // Era lebih tua menang meski tahunnya besar (tiap era mulai ulang Tahun 1)
    expect(compareDate(
      { era: 0, year: 1140, month: 7, day: 3 },
      { era: 1, year: 40, month: 2, day: 8 },
    )).toBeLessThan(0);
    expect(compareDate(
      { era: 2, year: 812, month: 4, day: 1 },
      { era: 2, year: 812, month: 4, day: 10 },
    )).toBeLessThan(0);
    expect(compareDate(
      { era: 2, year: 812, month: 4, day: 5 },
      { era: 2, year: 812, month: 4, day: 5 },
    )).toBe(0);
  });
});

describe('dayOfWeek / weekdayOfFirst', () => {
  it('hari 1 era = indeks weekday 0', () => {
    expect(dayOfWeek(fantasy, { era: 0, year: 1, month: 1, day: 1 })).toBe(0);
  });

  it('membungkus sesuai jumlah weekday (6)', () => {
    // hari ke-7 → ordinal 6 → 6 mod 6 = 0
    expect(dayOfWeek(fantasy, { era: 0, year: 1, month: 1, day: 7 })).toBe(0);
    // hari ke-6 → ordinal 5 → 5
    expect(dayOfWeek(fantasy, { era: 0, year: 1, month: 1, day: 6 })).toBe(5);
  });

  it('weekdayOfFirst = dayOfWeek hari 1 bulan', () => {
    const wf = weekdayOfFirst(fantasy, 0, 1, 2);
    expect(wf).toBe(dayOfWeek(fantasy, { era: 0, year: 1, month: 2, day: 1 }));
    // bulan 1 = 40 hari; hari 1 bulan 2 = ordinal 40 → 40 mod 6 = 4
    expect(wf).toBe(4);
  });

  it('mengembalikan -1 bila tak ada nama hari', () => {
    const noWeek: WorldCalendar = { ...fantasy, weekdays: [] };
    expect(dayOfWeek(noWeek, { era: 0, year: 1, month: 1, day: 1 })).toBe(-1);
  });
});

describe('addDays', () => {
  it('bergulir antar bulan', () => {
    expect(addDays(fantasy, { era: 0, year: 1, month: 1, day: 40 }, 1))
      .toEqual({ era: 0, year: 1, month: 2, day: 1 });
  });

  it('bergulir antar tahun (hari terakhir + 1)', () => {
    expect(addDays(fantasy, { era: 0, year: 1, month: 8, day: 44 }, 1))
      .toEqual({ era: 0, year: 2, month: 1, day: 1 });
  });

  it('mundur (n negatif) menyeberang batas tahun', () => {
    expect(addDays(fantasy, { era: 0, year: 2, month: 1, day: 1 }, -1))
      .toEqual({ era: 0, year: 1, month: 8, day: 44 });
  });

  it('addDays 0 = identitas', () => {
    const d = { era: 2, year: 812, month: 4, day: 10 };
    expect(addDays(fantasy, d, 0)).toEqual(d);
  });
});

describe('daysBetween', () => {
  it('selisih positif dalam satu era', () => {
    expect(daysBetween(fantasy,
      { era: 2, year: 812, month: 4, day: 1 },
      { era: 2, year: 812, month: 4, day: 10 },
    )).toBe(9);
  });

  it('konsisten dengan addDays', () => {
    const a = { era: 1, year: 40, month: 2, day: 8 };
    const b = addDays(fantasy, a, 100);
    expect(daysBetween(fantasy, a, b)).toBe(100);
  });

  it('null bila lintas era', () => {
    expect(daysBetween(fantasy,
      { era: 0, year: 1, month: 1, day: 1 },
      { era: 1, year: 1, month: 1, day: 1 },
    )).toBeNull();
  });
});

describe('seasonForMonth', () => {
  it('mencocokkan rentang biasa', () => {
    expect(seasonForMonth(greg, 7)?.name).toBe('Panas');
    expect(seasonForMonth(fantasy, 1)?.name).toBe('Semi');
  });

  it('menangani rentang yang membungkus akhir tahun', () => {
    // Gregorian "Dingin" = bulan 12–2
    expect(seasonForMonth(greg, 12)?.name).toBe('Dingin');
    expect(seasonForMonth(greg, 1)?.name).toBe('Dingin');
    expect(seasonForMonth(greg, 2)?.name).toBe('Dingin');
  });

  it('null bila tak ada musim', () => {
    expect(seasonForMonth(emptyCalendar(), 1)).toBeNull();
  });
});

describe('pelabelan', () => {
  it('eraLabel & eraAbbr', () => {
    expect(eraLabel(fantasy, 0)).toBe('Era Naga');
    expect(eraAbbr(fantasy, 0)).toBe('EN');
    expect(eraLabel(fantasy, 99)).toBe('Era 100');
  });

  it('formatDate', () => {
    expect(formatDate(fantasy, { era: 2, year: 812, month: 4, day: 12 }))
      .toBe('12 Highsun 812 EB');
  });

  it('formatDateRange satu bulan', () => {
    expect(formatDateRange(fantasy,
      { era: 2, year: 812, month: 4, day: 1 },
      { era: 2, year: 812, month: 4, day: 10 },
    )).toBe('1–10 Highsun 812 EB');
  });

  it('formatDateRange tanggal tunggal = formatDate', () => {
    const d = { era: 2, year: 812, month: 4, day: 12 };
    expect(formatDateRange(fantasy, d)).toBe(formatDate(fantasy, d));
    expect(formatDateRange(fantasy, d, d)).toBe(formatDate(fantasy, d));
  });

  it('formatDateRange lintas bulan', () => {
    expect(formatDateRange(fantasy,
      { era: 2, year: 812, month: 4, day: 40 },
      { era: 2, year: 812, month: 5, day: 3 },
    )).toBe('40 Highsun 812 EB – 3 Emberwane 812 EB');
  });
});

describe('preset & kalender kosong', () => {
  it('preset punya struktur lengkap', () => {
    for (const p of ['gregorian', 'fantasy', 'blank'] as const) {
      const c = calendarPreset(p);
      expect(c.eras.length).toBeGreaterThan(0);
      expect(c.weekdays.length).toBeGreaterThan(0);
      expect(c.months.length).toBeGreaterThan(0);
    }
  });

  it('emptyCalendar tetap bisa dirender (daysInYear > 0)', () => {
    expect(daysInYear(emptyCalendar())).toBeGreaterThan(0);
  });
});
