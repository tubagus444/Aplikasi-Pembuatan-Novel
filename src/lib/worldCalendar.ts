/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Kalender Dunia (#4) — aritmetika kalender in-world kustom, deterministik & nol token.
 *
 * Sumber tunggal logika turunan atas `WorldCalendar` + `WorldDate` (di `src/types.ts`).
 * Semua fungsi murni: grid, pita musim, pengelompokan, dan (fase 2) cek kelayakan
 * tanggal diturunkan dari sini. Konvensi:
 *   - `era`  = indeks ke `calendar.eras` (kecil = lebih tua; urutan array = kronologi).
 *   - `month`/`day` = 1-based.
 *   - Tiap era mulai ulang dari Tahun 1; angka tahun TIDAK menentukan urutan lintas-era.
 */

import type { WorldCalendar, WorldDate } from '@/src/types';

// ---------------------------------------------------------------------------
// Dasar
// ---------------------------------------------------------------------------

/** Total hari dalam satu tahun (jumlah hari semua bulan). 0 bila belum ada bulan. */
export function daysInYear(cal: WorldCalendar): number {
  return cal.months.reduce((sum, m) => sum + Math.max(0, Math.floor(m.days) || 0), 0);
}

/** Jumlah hari pada bulan (1-based). 0 bila indeks di luar rentang. */
export function daysInMonth(cal: WorldCalendar, month: number): number {
  const m = cal.months[month - 1];
  return m ? Math.max(0, Math.floor(m.days) || 0) : 0;
}

/**
 * Nomor hari ke-berapa dalam setahun (1-based) untuk sebuah tanggal — menjumlahkan
 * hari seluruh bulan sebelum `month` lalu menambah `day`.
 */
export function dayOfYear(cal: WorldCalendar, date: WorldDate): number {
  let total = 0;
  for (let i = 0; i < date.month - 1 && i < cal.months.length; i++) {
    total += Math.max(0, Math.floor(cal.months[i].days) || 0);
  }
  return total + date.day;
}

/**
 * Ordinal hari absolut dalam SATU era (0-based, sejak Tahun 1 Bulan 1 Hari 1).
 * Dipakai internal untuk `dayOfWeek`/`addDays`/`daysBetween`. Mengabaikan `era`.
 */
function eraOrdinal(cal: WorldCalendar, date: WorldDate): number {
  const yearLen = daysInYear(cal);
  return (date.year - 1) * yearLen + (dayOfYear(cal, date) - 1);
}

/** Modulo yang selalu mengembalikan hasil non-negatif (aman untuk tahun/ordinal negatif). */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

// ---------------------------------------------------------------------------
// Urutan & perbandingan
// ---------------------------------------------------------------------------

/**
 * Bandingkan dua tanggal secara kronologis: era → year → month → day.
 * Mengembalikan <0 bila `a` lebih tua, 0 bila sama, >0 bila `a` lebih baru.
 */
export function compareDate(a: WorldDate, b: WorldDate): number {
  return (a.era - b.era) || (a.year - b.year) || (a.month - b.month) || (a.day - b.day);
}

// ---------------------------------------------------------------------------
// Hari dalam seminggu (dihitung dari awal era)
// ---------------------------------------------------------------------------

/**
 * Indeks hari-dalam-seminggu (0-based ke `calendar.weekdays`) untuk sebuah tanggal,
 * dihitung dari awal era (Tahun 1 Bulan 1 Hari 1 = indeks 0). Mengembalikan -1 bila
 * kalender belum punya nama hari.
 */
export function dayOfWeek(cal: WorldCalendar, date: WorldDate): number {
  const wk = cal.weekdays.length;
  if (wk === 0) return -1;
  return mod(eraOrdinal(cal, date), wk);
}

/** Indeks weekday hari pertama sebuah bulan — dipakai untuk offset kolom awal grid. */
export function weekdayOfFirst(cal: WorldCalendar, era: number, year: number, month: number): number {
  return dayOfWeek(cal, { era, year, month, day: 1 });
}

// ---------------------------------------------------------------------------
// Aritmetika tanggal (dalam satu era)
// ---------------------------------------------------------------------------

/** Ubah ordinal era (0-based) kembali menjadi {year, month, day} pada `era` tertentu. */
function fromEraOrdinal(cal: WorldCalendar, era: number, ordinal: number): WorldDate {
  const yearLen = daysInYear(cal);
  if (yearLen <= 0) return { era, year: 1, month: 1, day: 1 };
  const year = Math.floor(ordinal / yearLen) + 1;
  let rem = mod(ordinal, yearLen); // hari ke-rem (0-based) dalam tahun
  let month = 1;
  for (let i = 0; i < cal.months.length; i++) {
    const len = Math.max(0, Math.floor(cal.months[i].days) || 0);
    if (rem < len) { month = i + 1; break; }
    rem -= len;
    month = i + 1;
  }
  return { era, year, month, day: rem + 1 };
}

/**
 * Tambah/kurang `n` hari dari sebuah tanggal, tetap dalam era yang sama.
 * Menghormati panjang bulan yang bervariasi & bergulir antar tahun.
 */
export function addDays(cal: WorldCalendar, date: WorldDate, n: number): WorldDate {
  if (daysInYear(cal) <= 0) return { ...date };
  return fromEraOrdinal(cal, date.era, eraOrdinal(cal, date) + n);
}

/**
 * Selisih hari `b - a` bila keduanya di era yang SAMA (positif bila `b` lebih baru).
 * Mengembalikan `null` bila era berbeda (lintas-era tak punya jarak hari yang bermakna
 * karena tiap era mulai ulang Tahun 1).
 */
export function daysBetween(cal: WorldCalendar, a: WorldDate, b: WorldDate): number | null {
  if (a.era !== b.era) return null;
  return eraOrdinal(cal, b) - eraOrdinal(cal, a);
}

// ---------------------------------------------------------------------------
// Musim
// ---------------------------------------------------------------------------

/**
 * Musim yang mencakup sebuah bulan (1-based), atau `null`. Menangani rentang yang
 * membungkus akhir tahun (mis. `fromMonth: 12, toMonth: 2`).
 */
export function seasonForMonth(cal: WorldCalendar, month: number): WorldCalendar['seasons'][number] | null {
  for (const s of cal.seasons) {
    if (s.fromMonth <= s.toMonth) {
      if (month >= s.fromMonth && month <= s.toMonth) return s;
    } else {
      // membungkus akhir tahun
      if (month >= s.fromMonth || month <= s.toMonth) return s;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pelabelan
// ---------------------------------------------------------------------------

/** Label era: singkatan bila ada, jika tidak nama, jika tidak "Era N+1". */
export function eraLabel(cal: WorldCalendar, era: number): string {
  const e = cal.eras[era];
  if (!e) return `Era ${era + 1}`;
  return e.name || e.abbr || `Era ${era + 1}`;
}

/** Singkatan era (untuk chip padat): abbr bila ada, jika tidak nama. */
export function eraAbbr(cal: WorldCalendar, era: number): string {
  const e = cal.eras[era];
  if (!e) return `E${era + 1}`;
  return e.abbr || e.name || `E${era + 1}`;
}

/**
 * Format tanggal ringkas: "12 Highsun 812 EK". Nama bulan diambil dari kalender;
 * bila indeks di luar rentang, dipakai "Bln {month}".
 */
export function formatDate(cal: WorldCalendar, date: WorldDate): string {
  const monthName = cal.months[date.month - 1]?.name || `Bln ${date.month}`;
  return `${date.day} ${monthName} ${date.year} ${eraAbbr(cal, date.era)}`;
}

/**
 * Format rentang: "12–14 Highsun 812 EK" bila satu bulan, atau
 * "Highsun 12 – Emberwane 3, 812 EK" bila lintas bulan; tanggal tunggal → `formatDate`.
 */
export function formatDateRange(cal: WorldCalendar, start: WorldDate, end?: WorldDate): string {
  if (!end || compareDate(start, end) === 0) return formatDate(cal, start);
  const startMonth = cal.months[start.month - 1]?.name || `Bln ${start.month}`;
  const endMonth = cal.months[end.month - 1]?.name || `Bln ${end.month}`;
  if (start.era === end.era && start.year === end.year && start.month === end.month) {
    return `${start.day}–${end.day} ${startMonth} ${start.year} ${eraAbbr(cal, start.era)}`;
  }
  return `${formatDate(cal, start)} – ${end.day} ${endMonth} ${end.year} ${eraAbbr(cal, end.era)}`;
}

// ---------------------------------------------------------------------------
// Preset kalender
// ---------------------------------------------------------------------------

export type CalendarPreset = 'gregorian' | 'fantasy' | 'blank';

const SEASON_COLORS = {
  spring: '#4ade80',
  summer: '#fbbf24',
  autumn: '#f97316',
  winter: '#60a5fa',
} as const;

/** Buat definisi kalender dari preset (titik mulai — penulis boleh menyunting bebas). */
export function calendarPreset(preset: CalendarPreset): WorldCalendar {
  switch (preset) {
    case 'gregorian':
      return {
        eras: [{ name: 'Masehi', abbr: 'M' }],
        weekdays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
        months: [
          { name: 'Januari', days: 31 }, { name: 'Februari', days: 28 },
          { name: 'Maret', days: 31 }, { name: 'April', days: 30 },
          { name: 'Mei', days: 31 }, { name: 'Juni', days: 30 },
          { name: 'Juli', days: 31 }, { name: 'Agustus', days: 31 },
          { name: 'September', days: 30 }, { name: 'Oktober', days: 31 },
          { name: 'November', days: 30 }, { name: 'Desember', days: 31 },
        ],
        seasons: [
          { name: 'Semi', fromMonth: 3, toMonth: 5, color: SEASON_COLORS.spring },
          { name: 'Panas', fromMonth: 6, toMonth: 8, color: SEASON_COLORS.summer },
          { name: 'Gugur', fromMonth: 9, toMonth: 11, color: SEASON_COLORS.autumn },
          { name: 'Dingin', fromMonth: 12, toMonth: 2, color: SEASON_COLORS.winter },
        ],
      };
    case 'fantasy':
      return {
        eras: [
          { name: 'Era Naga', abbr: 'EN' },
          { name: 'Era Kalantir', abbr: 'EK' },
          { name: 'Era Baru', abbr: 'EB' },
        ],
        weekdays: ['Sol', 'Lun', 'Ter', 'Aqua', 'Ven', 'Sabat'],
        months: [
          { name: 'Frostfall', days: 40 }, { name: 'Thawmoon', days: 36 },
          { name: 'Bloomtide', days: 42 }, { name: 'Highsun', days: 45 },
          { name: 'Emberwane', days: 40 }, { name: 'Harvest', days: 38 },
          { name: 'Duskfall', days: 36 }, { name: 'Deepnight', days: 44 },
        ],
        seasons: [
          { name: 'Semi', fromMonth: 1, toMonth: 2, color: SEASON_COLORS.spring },
          { name: 'Kemarau', fromMonth: 3, toMonth: 4, color: SEASON_COLORS.summer },
          { name: 'Gugur', fromMonth: 5, toMonth: 6, color: SEASON_COLORS.autumn },
          { name: 'Beku', fromMonth: 7, toMonth: 8, color: SEASON_COLORS.winter },
        ],
      };
    case 'blank':
    default:
      return {
        eras: [{ name: 'Era Pertama', abbr: 'E1' }],
        weekdays: ['Hari 1', 'Hari 2', 'Hari 3', 'Hari 4', 'Hari 5', 'Hari 6', 'Hari 7'],
        months: [{ name: 'Bulan 1', days: 30 }],
        seasons: [],
      };
  }
}

/** Kalender kosong minimal yang tetap bisa dirender (dipakai saat penulis mulai dari nol). */
export function emptyCalendar(): WorldCalendar {
  return calendarPreset('blank');
}
