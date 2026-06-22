/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Diff teks murni (tanpa DOM/library) untuk membandingkan dua versi naskah —
 * dipakai pratinjau perbandingan snapshot sebelum pemulihan. Word-level via LCS;
 * untuk dokumen sangat besar jatuh ke diff per-baris agar memori tetap terkendali.
 */

export type DiffType = 'equal' | 'insert' | 'delete';

export interface DiffSegment {
  type: DiffType;
  value: string;
}

/** Batas total token untuk diff word-level; di atas ini → fallback per-baris. */
const MAX_TOKENS = 5000;

/** Pecah jadi token kata + spasi (whitespace dipertahankan agar bisa direkonstruksi utuh). */
function tokenizeWords(text: string): string[] {
  return text.match(/\s+|\S+/g) || [];
}

/** Pecah jadi baris, newline dipertahankan di akhir tiap baris. */
function tokenizeLines(text: string): string[] {
  const lines = text.split('\n');
  return lines
    .map((l, i) => (i < lines.length - 1 ? l + '\n' : l))
    .filter((l) => l.length > 0);
}

function pushSegment(out: DiffSegment[], type: DiffType, value: string): void {
  const last = out[out.length - 1];
  if (last && last.type === type) last.value += value;
  else out.push({ type, value });
}

/** Diff dua array token via LCS (tabel penuh + backtrack). */
function lcsDiff(a: string[], b: string[]): DiffSegment[] {
  const n = a.length;
  const m = b.length;
  const cols = m + 1;
  // table[i*cols + j] = panjang LCS dari a[i:] dan b[j:]
  const table = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
    }
  }

  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSegment(out, 'equal', a[i]);
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      pushSegment(out, 'delete', a[i]);
      i++;
    } else {
      pushSegment(out, 'insert', b[j]);
      j++;
    }
  }
  while (i < n) pushSegment(out, 'delete', a[i++]);
  while (j < m) pushSegment(out, 'insert', b[j++]);
  return out;
}

/**
 * Bandingkan teks lama (`a`) → teks baru (`b`). Segmen `delete` = ada di `a` tapi
 * hilang di `b`; `insert` = baru di `b`. Untuk konteks pemulihan: `a` = naskah
 * sekarang, `b` = snapshot → `delete` akan hilang, `insert` akan muncul.
 */
export function diffText(a: string, b: string): DiffSegment[] {
  const aw = tokenizeWords(a);
  const bw = tokenizeWords(b);
  if (aw.length + bw.length <= MAX_TOKENS) {
    return lcsDiff(aw, bw);
  }
  // Dokumen besar: turunkan granularitas ke baris agar tabel LCS tetap kecil.
  return lcsDiff(tokenizeLines(a), tokenizeLines(b));
}

/** Ringkasan jumlah kata yang ditambah/dihapus (token non-whitespace). */
export function summarizeDiff(segments: DiffSegment[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const seg of segments) {
    if (seg.type === 'equal') continue;
    const words = (seg.value.match(/\S+/g) || []).length;
    if (seg.type === 'insert') added += words;
    else removed += words;
  }
  return { added, removed };
}
