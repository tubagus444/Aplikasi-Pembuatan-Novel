/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Retensi cadangan BERJENJANG (grandfather-father-son) — #3.
 *
 * Rotasi flat "simpan 5 terbaru" rentan: bila sebuah state buruk (bug hapus bab,
 * korupsi) tak disadari, dalam 5 siklus SEMUA cadangan bagus tergusur di setiap
 * lapisan. Retensi berjenjang menahan itu dengan menyimpan perwakilan pada rentang
 * waktu berbeda: N terbaru + satu-per-hari untuk beberapa hari + satu-per-minggu
 * untuk beberapa minggu — jadi selalu ada titik pulih lama yang selamat.
 *
 * Fungsi murni & deterministik agar bisa dipakai ulang oleh KETIGA lapisan
 * (IndexedDB internal, folder lokal, Google Drive) dan diuji terisolasi.
 */

export interface RetentionPolicy {
  recent: number; // jumlah cadangan terbaru yang selalu disimpan, apa pun harinya
  daily: number;  // simpan cadangan terbaru per-hari untuk `daily` hari terbaru
  weekly: number; // simpan cadangan terbaru per-minggu untuk `weekly` minggu terbaru
}

// Cakupan ~1 bulan: 5 terbaru + 7 harian + 4 mingguan (maksimum 16, biasanya lebih
// sedikit karena tumpang tindih). Gzip membuat jejak penyimpanannya tetap kecil.
export const DEFAULT_RETENTION: RetentionPolicy = { recent: 5, daily: 7, weekly: 4 };

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;

/**
 * Diberi daftar cadangan bertimestamp, kembalikan SUBSET yang harus DIHAPUS menurut
 * kebijakan. Yang dipertahankan = gabungan (union) dari: N terbaru, perwakilan
 * harian, dan perwakilan mingguan. Order-independent (menyortir sendiri).
 */
export function selectBackupsToDelete<T>(
  items: T[],
  getTimestamp: (item: T) => number,
  policy: RetentionPolicy = DEFAULT_RETENTION
): T[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => getTimestamp(b) - getTimestamp(a)); // terbaru dulu
  const keep = new Set<T>();

  // Recent: N terbaru, apa pun harinya.
  for (let i = 0; i < Math.min(policy.recent, sorted.length); i++) keep.add(sorted[i]);

  // Daily: item terbaru pada tiap hari (Map menjaga urutan sisip = hari menurun),
  // ambil `daily` hari paling baru. Yang tumpang tindih dg recent otomatis dedup.
  const dayReps = new Map<number, T>();
  for (const it of sorted) {
    const d = Math.floor(getTimestamp(it) / DAY_MS);
    if (!dayReps.has(d)) dayReps.set(d, it);
  }
  let dc = 0;
  for (const it of dayReps.values()) {
    if (dc >= policy.daily) break;
    keep.add(it);
    dc++;
  }

  // Weekly: item terbaru pada tiap minggu, ambil `weekly` minggu paling baru.
  const weekReps = new Map<number, T>();
  for (const it of sorted) {
    const w = Math.floor(getTimestamp(it) / WEEK_MS);
    if (!weekReps.has(w)) weekReps.set(w, it);
  }
  let wc = 0;
  for (const it of weekReps.values()) {
    if (wc >= policy.weekly) break;
    keep.add(it);
    wc++;
  }

  return sorted.filter((it) => !keep.has(it));
}

/**
 * Pilih SATU cadangan untuk DIBUANG saat penyimpanan penuh (degradasi kuota, BK#1).
 * Berbeda dari retensi berjenjang di atas (rotasi normal): ini dipakai HANYA saat
 * `db.backups.add` gagal karena kuota, untuk membebaskan ruang lalu retry.
 *
 * Kembalikan cadangan 'auto' TERTUA yang aman dibuang, atau `null` bila tak ada.
 * SELALU pertahankan: semua 'pre-restore' (jaring undo) + satu 'auto' terbaru — agar
 * lonjakan kuota tak menghapus seluruh riwayat demi satu cadangan yang bahkan mungkin
 * tetap tak muat.
 */
export function selectBackupToEvict<T>(
  items: T[],
  getTimestamp: (item: T) => number,
  isPreRestore: (item: T) => boolean
): T | null {
  const autos = items
    .filter((it) => !isPreRestore(it))
    .sort((a, b) => getTimestamp(a) - getTimestamp(b)); // tertua dulu
  if (autos.length <= 1) return null; // sisakan minimal satu cadangan baik
  return autos[0];
}
