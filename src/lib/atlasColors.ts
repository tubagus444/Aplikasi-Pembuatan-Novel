/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pewarnaan penanda Atlas — MURNI & deterministik. Warna DITURUNKAN (bukan
 * disimpan) dari faksi/kategori entri Codex yang ditaut penanda, konsisten dengan
 * cara #15 mendefinisikan faksi (= entri ber-`factionTag`, tanpa id faksi terpisah).
 *
 * Prioritas: `marker.color` eksplisit → hue faksi (bila entri ber-factionTag) →
 * warna kategori Codex → warna default per-jenis penanda.
 *
 * Peta hex kategori = SALINAN LOKAL (sama seperti LoreGraphPanel) karena
 * `codexCategories.ts` hanya menyimpan kelas Tailwind, bukan hex.
 */

import { CodexEntry } from '@/src/types';
import { CategoryDef, getCategoryDef } from '@/src/lib/codexCategories';

const CATEGORY_HEX: Record<string, string> = {
  indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e',
  sky: '#0ea5e9', slate: '#64748b', violet: '#8b5cf6', teal: '#14b8a6',
  orange: '#f97316', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
  pink: '#ec4899', cyan: '#06b6d4', lime: '#84cc16', fuchsia: '#d946ef',
};
const FALLBACK_HEX = '#64748b';

/** Palet stabil untuk faksi — dipilih via hash tag agar warna konsisten antar sesi. */
const FACTION_PALETTE = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#eab308',
];

/** Warna default per jenis bila penanda tak tertaut Codex & tanpa warna eksplisit. */
const KIND_DEFAULT: Record<string, string> = {
  pin: '#ef4444',
  area: '#8b5cf6',
  route: '#0ea5e9',
};

/** Hash string → index palet (djb2 sederhana, deterministik). */
export function factionHue(tag: string): string {
  let h = 5381;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) + h + tag.charCodeAt(i)) >>> 0;
  return FACTION_PALETTE[h % FACTION_PALETTE.length];
}

/** Warna kategori sebuah entri (hex). */
export function categoryHex(entry: CodexEntry, categories?: CategoryDef[]): string {
  const def = getCategoryDef(entry.category, categories);
  return CATEGORY_HEX[def?.color ?? ''] ?? FALLBACK_HEX;
}

/**
 * Warna render sebuah penanda. `entry` = entri Codex tertaut (bila ada).
 */
export function resolveMarkerColor(
  kind: string,
  explicitColor: string | undefined,
  entry: CodexEntry | undefined,
  categories?: CategoryDef[],
): string {
  if (explicitColor) return explicitColor;
  if (entry) {
    if (entry.factionTag && entry.factionTag.trim()) return factionHue(entry.factionTag.trim());
    return categoryHex(entry, categories);
  }
  return KIND_DEFAULT[kind] ?? FALLBACK_HEX;
}
