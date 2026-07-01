/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Chunking naskah untuk Pencarian Semantik.
 *
 * Memecah konten bab (HTML TipTap) menjadi potongan (chunk) berukuran adegan yang
 * jadi unit embedding. Keputusan desain: chunk per-ADEGAN (dipisah `***`/`---`/baris
 * kosong ganda), tetapi adegan yang panjang dipecah lagi ke sub-chunk ~120 kata agar
 * "sidik jari makna" tetap tajam (embedding satu blok raksasa jadi kabur).
 *
 * PENTING: modul ini diimpor oleh context worker (Web Worker) → TIDAK boleh memakai
 * DOMParser / API DOM. Konversi HTML→teks memakai regex saja.
 */

import { splitIntoScenes } from '@/src/lib/chunkEngine';

/** Target & batas ukuran sub-chunk (dalam kata) saat memecah adegan panjang. */
export const CHUNK_TARGET_WORDS = 120;
export const CHUNK_MAX_WORDS = 200;

export interface ManuscriptChunk {
  index: number;
  text: string;
  wordCount: number;
}

const BLOCK_TAG_RE = /<\/(?:p|div|h[1-6]|li|blockquote|pre)>|<br\s*\/?>|<hr\s*\/?>/gi;
const TAG_RE = /<[^>]*>/g;

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&apos;': "'", '&mdash;': '—', '&ndash;': '–',
};

/**
 * Konversi HTML bab menjadi teks polos dengan mempertahankan batas paragraf sebagai
 * newline (tag blok → `\n`), lalu menghapus sisa tag & mendekode entitas umum.
 * Tanpa DOM — aman di worker.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  let text = html.replace(BLOCK_TAG_RE, '\n').replace(TAG_RE, ' ');
  text = text.replace(/&#(\d+);/g, (_, code) => {
    const n = Number(code);
    return Number.isFinite(n) ? String.fromCodePoint(n) : _;
  });
  for (const [ent, ch] of Object.entries(ENTITIES)) {
    text = text.split(ent).join(ch);
  }
  // Rapikan spasi horizontal tanpa membuang newline (pembatas paragraf/adegan).
  return text
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * Pecah satu adegan panjang menjadi beberapa sub-chunk ~CHUNK_TARGET_WORDS kata,
 * memilih batas pada akhir paragraf/kalimat agar tidak memotong di tengah kalimat.
 */
function packScene(sceneText: string): string[] {
  const words = countWords(sceneText);
  if (words <= CHUNK_MAX_WORDS) return [sceneText.trim()];

  // Unit terkecil: paragraf; bila satu paragraf saja sudah melebihi batas, pecah
  // per kalimat.
  const paragraphs = sceneText.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const units: string[] = [];
  for (const p of paragraphs) {
    if (countWords(p) <= CHUNK_MAX_WORDS) {
      units.push(p);
    } else {
      const sentences = p.match(/[^.!?…]+[.!?…]+(?:["'”’)]+)?|\S[^.!?…]*$/g) || [p];
      let cur = '';
      for (const s of sentences) {
        const candidate = cur ? `${cur} ${s.trim()}` : s.trim();
        if (countWords(candidate) > CHUNK_MAX_WORDS && cur) {
          units.push(cur);
          cur = s.trim();
        } else {
          cur = candidate;
        }
      }
      if (cur) units.push(cur);
    }
  }

  // Greedy-pack unit hingga mendekati target.
  const chunks: string[] = [];
  let cur = '';
  for (const u of units) {
    const candidate = cur ? `${cur}\n${u}` : u;
    if (countWords(candidate) > CHUNK_TARGET_WORDS && cur) {
      chunks.push(cur);
      cur = u;
    } else {
      cur = candidate;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/**
 * Chunk konten bab (HTML) menjadi daftar potongan siap-embed. Chunk pendek
 * (< 4 kata, mis. penanda adegan sisa) dibuang agar tak mencemari hasil.
 */
export function chunkChapter(content: string): ManuscriptChunk[] {
  const plain = htmlToPlainText(content);
  if (!plain) return [];

  const scenes = splitIntoScenes(plain);
  const chunks: ManuscriptChunk[] = [];
  let index = 0;
  for (const scene of scenes) {
    for (const part of packScene(scene.content)) {
      const text = part.trim();
      const wc = countWords(text);
      if (wc < 4) continue;
      chunks.push({ index: index++, text, wordCount: wc });
    }
  }
  return chunks;
}

/**
 * Hash ringan & deterministik (FNV-1a 32-bit hex) untuk mendeteksi perubahan teks
 * chunk. Cukup untuk invalidasi cache embedding (bukan kriptografi).
 */
export function hashChunk(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
