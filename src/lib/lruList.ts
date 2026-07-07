/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Daftar LRU id numerik (terbaru di AKHIR). `touchLru` memindah `id` ke posisi paling
 * baru, lalu memangkas dari depan hingga panjang ≤ `cap`. Mengembalikan daftar baru +
 * id yang tergusur (untuk dibersihkan pemanggil, mis. `localStorage.removeItem`).
 *
 * Murni/deterministik → dipakai memberi pagar kuota pada cache yang menumpuk banyak
 * kunci (mis. cache konsistensi inline per-bab di localStorage).
 */
export function touchLru(list: number[], id: number, cap: number): { list: number[]; evicted: number[] } {
  const next = list.filter((x) => x !== id);
  next.push(id);
  const evicted: number[] = [];
  while (next.length > Math.max(0, cap)) {
    evicted.push(next.shift()!);
  }
  return { list: next, evicted };
}
