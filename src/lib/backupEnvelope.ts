/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Rakit string JSON cadangan penuh dengan MENYISIPKAN `dataString` (hasil satu kali
 * `JSON.stringify(data)`) alih-alih men-stringify ulang objek `data` yang besar.
 *
 * Kenapa: jalur rolling backup internal dulu men-stringify data besar DUA kali per
 * siklus (sekali untuk checksum, sekali untuk payload envelope) → puncak memori &
 * jank main thread tiap 30 menit pada naskah besar. Dengan memisahkan serialisasi
 * data (sekali) dari perakitan envelope (operasi string kecil), kita memangkasnya.
 *
 * `meta` = field envelope SELAIN `data` (version/timestamp/checksum/scope/projectName).
 * Objek kecil, aman di-stringify. Hasil = `{ ...meta, "data": <dataString> }` sebagai
 * teks — byte-identik dengan `JSON.stringify({ ...meta, data })` untuk key yang sama.
 */
export function assembleBackupJson(meta: Record<string, unknown>, dataString: string): string {
  const metaString = JSON.stringify(meta); // hanya objek KECIL
  const inner = metaString.slice(1, -1); // buang kurung kurawal pembungkus
  return inner ? `{${inner},"data":${dataString}}` : `{"data":${dataString}}`;
}
