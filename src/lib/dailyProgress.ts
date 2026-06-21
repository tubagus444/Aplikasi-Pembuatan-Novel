/**
 * Pelacakan progres menulis harian (target sesi & streak).
 *
 * Disimpan per-proyek sebagai field NON-INDEKS di tabel `projects` (lihat `Project`
 * di types.ts) sehingga ikut tercadangkan via `collectAllData` tanpa perlu bump skema
 * Dexie. Semua fungsi di sini MURNI agar mudah diuji; efek tulis ke Dexie dilakukan
 * pemanggil (lihat `useDailyProgress`).
 *
 * Model: kita menyimpan baseline "total kata terakhir teramati" + tanggalnya, lalu
 * mengakumulasi hanya DELTA POSITIF ke `dailyLog[hari]`. Artinya angka "kata hari ini"
 * bersifat effort-based — penghapusan tidak menguranginya — sama seperti tracker menulis
 * pada umumnya, sekaligus menghindari hasil negatif saat penulis memangkas naskah.
 */

export interface DailyProgress {
  /** 'YYYY-MM-DD' (lokal) → kata yang ditulis pada hari itu. */
  dailyLog: Record<string, number>;
  /** Total kata terakhir teramati (untuk menghitung delta). */
  lastWordCount: number;
  /** Tanggal observasi terakhir 'YYYY-MM-DD' (lokal). */
  lastWordCountDate: string;
}

/** Kunci tanggal lokal 'YYYY-MM-DD'. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Hitung state baru setelah mengamati `currentTotal` kata pada hari `today`.
 * - Hari berganti / observasi pertama → jadikan baseline (tak mengatribusikan lonjakan
 *   ke hari ini, dan pastikan ada entri 0 untuk hari ini).
 * - Hari sama → tambahkan hanya delta positif ke log hari ini.
 *
 * Selalu mengembalikan objek baru; pemanggil boleh membandingkan untuk melewati tulis.
 */
export function recordWordCount(
  prev: Partial<DailyProgress> | undefined,
  currentTotal: number,
  today: string = dayKey(),
): DailyProgress {
  const dailyLog = { ...(prev?.dailyLog ?? {}) };
  const sameDay = prev?.lastWordCountDate === today && typeof prev?.lastWordCount === 'number';

  if (!sameDay) {
    if (dailyLog[today] === undefined) dailyLog[today] = 0;
    return { dailyLog, lastWordCount: currentTotal, lastWordCountDate: today };
  }

  const delta = currentTotal - (prev!.lastWordCount as number);
  if (delta > 0) dailyLog[today] = (dailyLog[today] ?? 0) + delta;
  return { dailyLog, lastWordCount: currentTotal, lastWordCountDate: today };
}

/** Kata yang ditulis pada `day` (selalu ≥ 0). */
export function wordsOnDay(
  dailyLog: Record<string, number> | undefined,
  day: string = dayKey(),
): number {
  return Math.max(0, dailyLog?.[day] ?? 0);
}

/** Tanggal kemarin relatif terhadap kunci `day`. */
function previousDay(day: string): string {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/**
 * Streak hari berturut-turut yang memenuhi `dailyGoal`, dihitung mundur dari `today`.
 * Bila hari ini BELUM memenuhi target, streak tetap dihitung mundur dari kemarin agar
 * tidak langsung nol di pagi hari sebelum penulis sempat menulis.
 */
export function computeStreak(
  dailyLog: Record<string, number> | undefined,
  dailyGoal: number,
  today: string = dayKey(),
): number {
  if (!dailyLog || dailyGoal <= 0) return 0;
  let streak = 0;
  let cursor = today;
  if (wordsOnDay(dailyLog, today) < dailyGoal) {
    cursor = previousDay(today); // hari ini belum tercapai → jangan putus streak kemarin
  }
  while (wordsOnDay(dailyLog, cursor) >= dailyGoal) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}
