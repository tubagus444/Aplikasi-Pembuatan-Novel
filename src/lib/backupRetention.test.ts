/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { selectBackupsToDelete, selectBackupToEvict, DEFAULT_RETENTION, RetentionPolicy } from './backupRetention';

const DAY_MS = 86_400_000;
// Timestamp untuk "hari ke-n" pada tengah hari agar urutan intra-hari deterministik.
const dayTs = (n: number) => n * DAY_MS + DAY_MS / 2;

describe('selectBackupsToDelete', () => {
  it('mengembalikan array kosong untuk input kosong', () => {
    expect(selectBackupsToDelete([], (x: number) => x)).toEqual([]);
  });

  it('tidak menghapus apa pun bila jumlah item <= recent', () => {
    const items = [dayTs(0), dayTs(1), dayTs(2)];
    expect(selectBackupsToDelete(items, (x) => x)).toEqual([]);
  });

  it('untuk banyak cadangan pada HARI yang sama, hanya menyimpan `recent`', () => {
    // 10 cadangan di hari 0 → satu-satunya day/week rep adalah yang terbaru
    // (sudah termasuk recent), jadi total tersimpan = recent (5).
    const base = dayTs(0);
    const items = Array.from({ length: 10 }, (_, i) => base + i * 60_000);
    const toDelete = selectBackupsToDelete(items, (x) => x);
    expect(toDelete.length).toBe(10 - DEFAULT_RETENTION.recent);
  });

  it('mempertahankan perwakilan harian & mingguan yang lama (bukan sekadar 5 terbaru)', () => {
    // Satu cadangan per hari untuk 30 hari (hari 29 = terbaru).
    const items = Array.from({ length: 30 }, (_, i) => dayTs(i));
    const toDelete = new Set(selectBackupsToDelete(items, (x) => x));
    const kept = items.filter((it) => !toDelete.has(it));

    // 5 terbaru selalu ada.
    for (const d of [29, 28, 27, 26, 25]) expect(kept).toContain(dayTs(d));
    // Perwakilan harian menjangkau lebih jauh dari 5 terbaru (hari 23 & 24).
    expect(kept).toContain(dayTs(24));
    expect(kept).toContain(dayTs(23));
    // Perwakilan mingguan menjaga titik pulih jauh (minggu 2 → hari 20, minggu 1 → hari 13).
    expect(kept).toContain(dayTs(20));
    expect(kept).toContain(dayTs(13));
    // Hari di antara yang bukan perwakilan apa pun harus terhapus.
    expect(kept).not.toContain(dayTs(15));
    expect(kept).not.toContain(dayTs(8));
  });

  it('menghormati kebijakan kustom', () => {
    const policy: RetentionPolicy = { recent: 1, daily: 0, weekly: 0 };
    const items = [dayTs(0), dayTs(1), dayTs(2)];
    const toDelete = selectBackupsToDelete(items, (x) => x, policy);
    // Hanya menyimpan 1 terbaru (hari 2) → hapus hari 0 & 1.
    expect(toDelete.sort()).toEqual([dayTs(0), dayTs(1)].sort());
  });

  it('bekerja pada item objek via getTimestamp', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: i, ts: dayTs(i) }));
    const toDelete = selectBackupsToDelete(items, (b) => b.ts, { recent: 2, daily: 0, weekly: 0 });
    // Simpan 2 terbaru (id 7,6) → hapus 6 sisanya.
    expect(toDelete.map((b) => b.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('selectBackupToEvict', () => {
  interface B { id: number; ts: number; kind: 'auto' | 'pre-restore'; }
  const auto = (id: number, day: number): B => ({ id, ts: dayTs(day), kind: 'auto' });
  const pre = (id: number, day: number): B => ({ id, ts: dayTs(day), kind: 'pre-restore' });
  const pick = (items: B[]) => selectBackupToEvict(items, (b) => b.ts, (b) => b.kind === 'pre-restore');

  it('mengembalikan null untuk daftar kosong', () => {
    expect(pick([])).toBeNull();
  });

  it('mengembalikan cadangan auto TERTUA', () => {
    const victim = pick([auto(1, 5), auto(2, 1), auto(3, 3)]);
    expect(victim?.id).toBe(2); // hari 1 = tertua
  });

  it('menyisakan minimal satu cadangan auto (tak membuang yang terakhir)', () => {
    expect(pick([auto(1, 5)])).toBeNull();
  });

  it('tak pernah membuang pre-restore (jaring undo)', () => {
    // Hanya ada satu auto + beberapa pre-restore → tak ada yang aman dibuang.
    expect(pick([auto(1, 5), pre(2, 1), pre(3, 2)])).toBeNull();
  });

  it('membuang auto tertua walau ada pre-restore lebih tua', () => {
    const victim = pick([pre(1, 0), auto(2, 4), auto(3, 2)]);
    expect(victim?.id).toBe(3); // auto hari 2, bukan pre-restore hari 0
  });
});
