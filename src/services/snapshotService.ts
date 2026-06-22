/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Snapshot otomatis sebelum aksi destruktif (rewrite AI "Ganti Teks", Find &
 * Replace "Ganti Semua", pemulihan versi). Memberi titik balik tanpa pengguna
 * perlu menekan tombol kamera manual. Best-effort: kegagalan tak boleh memblok
 * atau menggagalkan aksi utama.
 */
import { db } from '@/src/db';
import { format } from 'date-fns';

/** Maksimal snapshot otomatis yang disimpan per-bab; sisanya (terlama) dipangkas. */
const MAX_AUTO_PER_CHAPTER = 12;

/**
 * Simpan snapshot otomatis berisi konten LAMA bab sebelum ditimpa. `reason` jadi
 * awalan label (mis. "Sebelum tenun AI"). Mengembalikan id snapshot, atau null
 * bila dilewati (konten kosong) / gagal.
 */
export async function createAutoSnapshot(
  chapterId: number,
  content: string,
  reason: string,
): Promise<number | null> {
  if (!chapterId || chapterId <= 0) return null;
  if (!content || !content.trim()) return null;
  try {
    const id = await db.snapshots.add({
      chapterId,
      content,
      label: `${reason} — ${format(new Date(), 'd MMM, HH:mm')}`,
      timestamp: Date.now(),
      auto: true,
    });

    // Pangkas snapshot otomatis terlama agar tidak membengkak (snapshot manual
    // sengaja tidak ikut dipangkas).
    const autos = await db.snapshots
      .where('chapterId')
      .equals(chapterId)
      .filter((s) => s.auto === true)
      .sortBy('timestamp');
    if (autos.length > MAX_AUTO_PER_CHAPTER) {
      const stale = autos.slice(0, autos.length - MAX_AUTO_PER_CHAPTER).map((s) => s.id!);
      await db.snapshots.bulkDelete(stale);
    }

    return id as number;
  } catch (err) {
    console.error('Auto-snapshot gagal:', err);
    return null;
  }
}
