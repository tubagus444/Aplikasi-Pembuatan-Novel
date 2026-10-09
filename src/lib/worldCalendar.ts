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

import type { WorldCalendar, WorldDate, WorldCalendarHoliday } from '@/src/types';

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

/**
 * Pecah jumlah hari absolut menjadi unit { years, months, days, isNegative }
 * berdasarkan panjang tahun dan bulan pada kalender dunia aktif.
 */
export function breakdownDays(cal: WorldCalendar, totalDays: number): {
  years: number;
  months: number;
  days: number;
  isNegative: boolean;
} {
  const isNegative = totalDays < 0;
  const abs = Math.abs(totalDays);
  const yLen = daysInYear(cal);
  if (yLen <= 0) return { years: 0, months: 0, days: abs, isNegative };

  const years = Math.floor(abs / yLen);
  let rem = abs % yLen;
  let months = 0;

  for (let i = 0; i < cal.months.length; i++) {
    const mDays = Math.max(1, Math.floor(cal.months[i].days) || 1);
    if (rem >= mDays) {
      rem -= mDays;
      months++;
    } else {
      break;
    }
  }

  return { years, months, days: rem, isNegative };
}

/**
 * Format selisih hari menjadi teks ramah baca (mis. "1 tahun 2 bulan 5 hari").
 */
export function formatDaysBreakdown(cal: WorldCalendar, totalDays: number): string {
  const { years, months, days, isNegative } = breakdownDays(cal, totalDays);
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  if (days > 0 || parts.length === 0) parts.push(`${days} hari`);
  const text = parts.join(' ');
  return isNegative ? `-${text}` : text;
}

/**
 * Tambah/kurang sejumlah bulan dari tanggal, menyesuaikan tahun & membatasi hari ke panjang bulan baru.
 */
export function addMonths(cal: WorldCalendar, date: WorldDate, n: number): WorldDate {
  const mCount = cal.months.length;
  if (mCount <= 0) return { ...date };
  const current0 = date.month - 1;
  const target0 = current0 + n;
  const yearOffset = Math.floor(target0 / mCount);
  const newMonth = mod(target0, mCount) + 1;
  const newYear = Math.max(1, date.year + yearOffset);
  const maxDay = daysInMonth(cal, newMonth) || 1;
  const newDay = Math.min(Math.max(1, date.day), maxDay);
  return { era: date.era, year: newYear, month: newMonth, day: newDay };
}

// ---------------------------------------------------------------------------
// Moda Transportasi & Kecepatan Perjalanan Dunia Fantasi
// ---------------------------------------------------------------------------

export interface TravelModeInfo {
  id: string;
  name: string;
  speedKmPerDay: number;
  description: string;
  category: 'land' | 'water' | 'air';
}

export const TRAVEL_MODES: TravelModeInfo[] = [
  { id: 'foot', name: 'Jalan Kaki / Pasukan', speedKmPerDay: 20, description: 'Barisan tentara, pengelana tanpa tunggangan, atau pejalan kaki dengan beban ransel', category: 'land' },
  { id: 'carriage', name: 'Kereta Kuda / Kafilah', speedKmPerDay: 30, description: 'Rombongan pedagang, kereta keluarga bangsawan, atau gerobak logistik', category: 'land' },
  { id: 'horse', name: 'Kuda Tunggang Santai', speedKmPerDay: 45, description: 'Penunggang kuda tunggal dengan ritme istirahat teratur', category: 'land' },
  { id: 'courier', name: 'Kurir Kuda Kilat', speedKmPerDay: 80, description: 'Kurir pos istana dengan stamina prima atau pergantian kuda di stasiun perhentian', category: 'land' },
  { id: 'ship', name: 'Kapal Layar / Perahu Sungai', speedKmPerDay: 120, description: 'Pelayaran pantai atau arus sungai dengan navigasi siang-malam', category: 'water' },
  { id: 'bird', name: 'Burung Pos / Pesan Udara', speedKmPerDay: 250, description: 'Merpati pos, rajawali pengintai, atau transmisi pesan langsung tanpa hambatan darat', category: 'air' },
];


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
// Hari Libur & Festival Tahunan (Recurring Holidays)
// ---------------------------------------------------------------------------

/** Dapatkan semua hari libur/festival tahunan yang jatuh pada bulan dan hari tertentu. */
export function holidaysOnDate(cal: WorldCalendar, month: number, day: number): WorldCalendarHoliday[] {
  if (!cal.holidays?.length) return [];
  return cal.holidays.filter(h => h.month === month && h.day === day);
}

// ---------------------------------------------------------------------------
// Pelacak Usia Karakter Dinamis (Dynamic Age Tracker)
// ---------------------------------------------------------------------------

export interface CharacterAgeInfo {
  years: number;
  months: number;
  days: number;
  isBirthday: boolean;
  isUnborn: boolean;
  formatted: string;
}

/**
 * Hitung usia karakter pada tanggal peristiwa tertentu secara deterministik.
 * Mengembalikan informasi tahun, bulan, status ulang tahun, atau status belum lahir.
 */
export function calculateCharacterAge(
  cal: WorldCalendar,
  birthDate: WorldDate,
  currentDate: WorldDate
): CharacterAgeInfo | null {
  if (birthDate.era !== currentDate.era) {
    if (currentDate.era < birthDate.era) {
      return {
        years: -1,
        months: 0,
        days: 0,
        isBirthday: false,
        isUnborn: true,
        formatted: 'Belum lahir (era mendatang)',
      };
    }
    return {
      years: currentDate.year,
      months: 0,
      days: 0,
      isBirthday: false,
      isUnborn: false,
      formatted: `Lahir di ${eraLabel(cal, birthDate.era)}`,
    };
  }

  const diff = daysBetween(cal, birthDate, currentDate);
  if (diff === null) return null;

  if (diff < 0) {
    const bd = breakdownDays(cal, Math.abs(diff));
    const formatted = bd.years > 0
      ? `Belum lahir (-${bd.years} thn)`
      : `Belum lahir (-${bd.days} hari)`;
    return {
      years: -bd.years,
      months: -bd.months,
      days: -bd.days,
      isBirthday: false,
      isUnborn: true,
      formatted,
    };
  }

  const isBirthday =
    birthDate.month === currentDate.month &&
    birthDate.day === currentDate.day &&
    diff > 0;

  // Hitung selisih tahun kalender
  let years = currentDate.year - birthDate.year;
  if (
    currentDate.month < birthDate.month ||
    (currentDate.month === birthDate.month && currentDate.day < birthDate.day)
  ) {
    years = Math.max(0, years - 1);
  }

  // Hitung sisa bulan dan hari sejak ulang tahun terakhir di tahun ini
  const lastBday: WorldDate = {
    era: birthDate.era,
    year: birthDate.year + years,
    month: birthDate.month,
    day: Math.min(birthDate.day, daysInMonth(cal, birthDate.month) || 1),
  };
  const daysSinceBday = Math.max(0, daysBetween(cal, lastBday, currentDate) ?? 0);
  const bdSince = breakdownDays(cal, daysSinceBday);

  let formatted = `${years} thn`;
  if (isBirthday) {
    formatted = `${years} thn (🎂 Ulang tahun!)`;
  } else if (years === 0) {
    if (bdSince.months > 0) {
      formatted = `${bdSince.months} bln ${bdSince.days} hr`;
    } else {
      formatted = `${bdSince.days} hari`;
    }
  }

  return {
    years,
    months: bdSince.months,
    days: bdSince.days,
    isBirthday,
    isUnborn: false,
    formatted,
  };
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
        holidays: [
          { id: 'greg-1', name: 'Tahun Baru', month: 1, day: 1, color: '#60a5fa', description: 'Awal tahun kalender baru' },
          { id: 'greg-2', name: 'Hari Kemerdekaan', month: 8, day: 17, color: '#f87171', description: 'Peringatan kemerdekaan nasional' },
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
        holidays: [
          { id: 'fan-1', name: 'Titik Balik Matahari Panas', month: 4, day: 1, color: '#fbbf24', description: 'Puncak musim kemarau dan ritual pemujaan matahari' },
          { id: 'fan-2', name: 'Pesta Panen Raya', month: 6, day: 1, color: '#f97316', description: 'Perayaan lumbung hasil bumi seluruh negeri' },
          { id: 'fan-3', name: 'Malam Cahaya Beku', month: 8, day: 44, color: '#a78bfa', description: 'Malam terpanjang di pengujung tahun' },
        ],
      };
    case 'blank':
    default:
      return {
        eras: [{ name: 'Era Pertama', abbr: 'E1' }],
        weekdays: ['Hari 1', 'Hari 2', 'Hari 3', 'Hari 4', 'Hari 5', 'Hari 6', 'Hari 7'],
        months: [{ name: 'Bulan 1', days: 30 }],
        seasons: [],
        holidays: [],
      };
  }
}

/** Kalender kosong minimal yang tetap bisa dirender (dipakai saat penulis mulai dari nol). */
export function emptyCalendar(): WorldCalendar {
  return calendarPreset('blank');
}
