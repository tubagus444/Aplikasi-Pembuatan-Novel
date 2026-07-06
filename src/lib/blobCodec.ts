/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Konversi Blob ↔ data URL (base64) — dipakai backup/impor untuk menyelipkan
 * gambar biner (peta Atlas) ke dalam envelope JSON. `Blob` tak selamat lewat
 * `JSON.stringify` (jadi `{}`), jadi wajib dikodekan saat ekspor & didekode saat
 * restore/impor. Data URL menyimpan tipe MIME sekaligus isinya.
 */

/** Blob → data URL (mis. `data:image/webp;base64,...`). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca blob'));
    reader.readAsDataURL(blob);
  });
}

/** Data URL → Blob (kebalikan `blobToDataUrl`). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
