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

const CLAUDE_CACHE_TTL_KEY = 'ai_claude_cache_ttl';
export type ClaudeCacheTtl = '5m' | '1h';
export const DEFAULT_CLAUDE_CACHE_TTL: ClaudeCacheTtl = '1h';

/**
 * Masa hidup (TTL) prompt cache Claude langsung (RENCANA-OPTIMASI-AI #P5). Anthropic
 * menagih premi TULIS cache: 1.25× untuk 5 menit, 2× untuk 1 jam (baca tetap 0.1×). Maka:
 * - **1 jam (default):** cache bertahan melewati jeda berpikir/mengetik → optimal untuk
 *   sesi menulis panjang yang banyak membaca cache (apalagi setelah KB dibagi lintas-aksi).
 * - **5 menit:** premi tulis lebih murah → lebih hemat untuk pola "colek sesekali lalu
 *   tutup" di mana cache jarang sempat dibaca ulang.
 * Hanya berlaku untuk provider `claude` langsung (OpenRouter tetap 5 menit; Google pakai
 * TTL implicit-nya sendiri). Nilai tak dikenal → default 1 jam.
 */
export function getClaudeCacheTtl(): ClaudeCacheTtl {
  try {
    return localStorage.getItem(CLAUDE_CACHE_TTL_KEY) === '5m' ? '5m' : '1h';
  } catch {
    return DEFAULT_CLAUDE_CACHE_TTL;
  }
}
