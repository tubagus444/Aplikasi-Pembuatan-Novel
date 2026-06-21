import { describe, it, expect } from 'vitest';
import { recordWordCount, wordsOnDay, computeStreak, dayKey } from './dailyProgress';

describe('dayKey', () => {
  it('memformat tanggal lokal sebagai YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 5, 21))).toBe('2026-06-21');
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('recordWordCount', () => {
  it('observasi pertama menjadi baseline tanpa mengatribusikan kata ke hari ini', () => {
    const s = recordWordCount(undefined, 5000, '2026-06-21');
    expect(s.lastWordCount).toBe(5000);
    expect(s.lastWordCountDate).toBe('2026-06-21');
    expect(wordsOnDay(s.dailyLog, '2026-06-21')).toBe(0);
  });

  it('mengakumulasi delta positif pada hari yang sama', () => {
    let s = recordWordCount(undefined, 5000, '2026-06-21');
    s = recordWordCount(s, 5300, '2026-06-21');
    s = recordWordCount(s, 5500, '2026-06-21');
    expect(wordsOnDay(s.dailyLog, '2026-06-21')).toBe(500);
    expect(s.lastWordCount).toBe(5500);
  });

  it('mengabaikan delta negatif (penghapusan tak mengurangi kata hari ini)', () => {
    let s = recordWordCount(undefined, 5000, '2026-06-21');
    s = recordWordCount(s, 5400, '2026-06-21'); // +400
    s = recordWordCount(s, 5100, '2026-06-21'); // -300, diabaikan
    expect(wordsOnDay(s.dailyLog, '2026-06-21')).toBe(400);
    expect(s.lastWordCount).toBe(5100); // baseline tetap maju agar tambahan berikutnya akurat
    s = recordWordCount(s, 5250, '2026-06-21'); // +150 dari 5100
    expect(wordsOnDay(s.dailyLog, '2026-06-21')).toBe(550);
  });

  it('pergantian hari mereset baseline tanpa membawa lonjakan ke hari baru', () => {
    let s = recordWordCount(undefined, 5000, '2026-06-21');
    s = recordWordCount(s, 5800, '2026-06-21'); // hari 1: +800
    s = recordWordCount(s, 6500, '2026-06-22'); // hari berganti → baseline 6500, hari 2 = 0
    expect(wordsOnDay(s.dailyLog, '2026-06-21')).toBe(800);
    expect(wordsOnDay(s.dailyLog, '2026-06-22')).toBe(0);
    s = recordWordCount(s, 6900, '2026-06-22'); // hari 2: +400
    expect(wordsOnDay(s.dailyLog, '2026-06-22')).toBe(400);
  });
});

describe('computeStreak', () => {
  it('menghitung hari berturut-turut yang memenuhi target', () => {
    const log = {
      '2026-06-19': 1600,
      '2026-06-20': 2000,
      '2026-06-21': 1500,
    };
    expect(computeStreak(log, 1500, '2026-06-21')).toBe(3);
  });

  it('hari ini belum tercapai tetap menjaga streak dari kemarin', () => {
    const log = {
      '2026-06-19': 1600,
      '2026-06-20': 2000,
      '2026-06-21': 200, // belum capai
    };
    expect(computeStreak(log, 1500, '2026-06-21')).toBe(2);
  });

  it('hari yang bolong memutus streak', () => {
    const log = {
      '2026-06-18': 1600,
      // 19 bolong
      '2026-06-20': 2000,
      '2026-06-21': 1700,
    };
    expect(computeStreak(log, 1500, '2026-06-21')).toBe(2);
  });

  it('mengembalikan 0 bila target tak valid atau log kosong', () => {
    expect(computeStreak(undefined, 1500, '2026-06-21')).toBe(0);
    expect(computeStreak({ '2026-06-21': 5000 }, 0, '2026-06-21')).toBe(0);
  });
});
