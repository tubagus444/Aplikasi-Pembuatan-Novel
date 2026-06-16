// Tuning optimasi AI yang bisa diubah pengguna lewat Settings (disimpan di
// localStorage). Lihat RENCANA-OPTIMASI-AI.md (#5, #7).
//
// PENTING: helper di sini membaca localStorage, jadi HANYA boleh dipanggil di
// main thread. Web Worker tak punya akses localStorage — untuk worker, teruskan
// nilainya lewat payload pesan (lihat previewContextTokens di contextEngine.ts).

const LORE_CHARS_KEY = 'ai_max_cached_lore_chars';
export const DEFAULT_MAX_CACHED_LORE_CHARS = 50000;
export const LORE_CHARS_MIN = 10000;
export const LORE_CHARS_MAX = 100000;

/**
 * Plafon karakter Codex yang ditulis ke system prompt statis di mode caching
 * (`buildCachedContextBlock`). Lebih kecil = cache lebih murah ditulis ulang saat
 * lore sering diedit di tengah sesi; lebih besar = lebih banyak lore sampai ke AI.
 * Di-clamp ke rentang waras agar nilai localStorage yang rusak tak merusak konteks.
 */
export function getMaxCachedLoreChars(): number {
  try {
    const raw = localStorage.getItem(LORE_CHARS_KEY);
    if (!raw) return DEFAULT_MAX_CACHED_LORE_CHARS;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return DEFAULT_MAX_CACHED_LORE_CHARS;
    return Math.min(LORE_CHARS_MAX, Math.max(LORE_CHARS_MIN, n));
  } catch {
    return DEFAULT_MAX_CACHED_LORE_CHARS;
  }
}
