/**
 * Deteksi nama-diri BARU (belum di Codex) dari satu pesan chat AI — pemicu chip
 * "Buka di Lokakarya". Menumpang mesin heuristik `findOrphanEntities` (Aho-Corasick
 * terbalik) dengan memperlakukan pesan sebagai satu "bab" dan ambang minCount=1.
 * Nol token, murni lokal.
 */

import { findOrphanEntities } from '@/src/lib/orphanEntities';
import { CodexEntry } from '@/src/types';

/** Buang penanda markdown inline (bold/italic/kode) agar nama tak terpecah oleh simbol. */
function stripMarkdownInline(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ') // blok kode
    .replace(/`[^`]*`/g, ' ') // kode inline
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // tautan/gambar → teks
    .replace(/[*_~]{1,3}/g, '') // bold/italic/strikethrough
    .replace(/^#{1,6}\s+/gm, ''); // heading
}

export interface ChatEntityScanOptions {
  /** Maksimum nama yang ditawarkan per pesan (default 4). */
  max?: number;
}

/**
 * Kembalikan daftar nama-diri di `text` yang belum ada di Codex (nama+alias),
 * terurut dari yang paling menonjol. Kosong bila tak ada kandidat meyakinkan.
 */
export function scanNewEntities(
  text: string,
  codexEntries: Pick<CodexEntry, 'name' | 'aliases'>[],
  options?: ChatEntityScanOptions
): string[] {
  if (!text || !text.trim()) return [];
  const clean = stripMarkdownInline(text);
  // minCount 1: di chat sebuah nama bisa disebut sekali; findOrphanEntities tetap
  // menuntut minimal satu kemunculan "kuat" (kapital di tengah kalimat) → menyaring
  // kata awal-kalimat biasa. Stopword & set Codex menyaring sisanya.
  const candidates = findOrphanEntities([{ content: clean }], codexEntries, { minCount: 1 });
  const max = options?.max ?? 4;
  return candidates.slice(0, max).map((c) => c.name);
}
