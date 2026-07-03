/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodexEntry, WorldStatus } from '@/src/types';

/**
 * Pelacak kelengkapan worldbuilding (#11) — logika murni, deterministik & nol token.
 *
 * Filosofi (searah Janji Plot): penulis MENDEKLARASIKAN status kematangan tiap entri
 * (`CodexEntry.worldStatus`), alat hanya MEMBUKUKAN & meringkas. Bila belum ditetapkan,
 * alat menawarkan SARAN lembut (`suggestStatus`) berdasarkan kepadatan deskripsi/field —
 * tak disimpan sampai penulis mengonfirmasi. Tak ada tabel/FK baru: kedua field
 * (`worldStatus`, `todo`) menumpang objek codex. Tak menyentuh jalur AI/ekspor.
 */

export const WORLD_STATUSES: WorldStatus[] = ['stub', 'partial', 'solid'];

export const STATUS_LABEL: Record<WorldStatus, string> = {
  stub: 'Rangka',
  partial: 'Parsial',
  solid: 'Solid',
};

/** Hitung kata pada teks polos/Markdown (deskripsi codex bukan HTML). */
function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/**
 * Saran status "lembut" saat penulis belum menetapkan `worldStatus`. Heuristik
 * konservatif berbasis kepadatan konten (deskripsi = sinyal utama; field/secret
 * mengangkat dari 'stub'). Sengaja sederhana & deterministik — hanya petunjuk,
 * bukan penghakiman.
 */
export function suggestStatus(entry: Pick<CodexEntry, 'description' | 'customFields' | 'secret'>): WorldStatus {
  const words = countWords(entry.description || '');
  const hasExtras = (entry.customFields?.some(f => f.value?.trim()) ?? false) || !!entry.secret?.trim();
  if (words < 15) return hasExtras ? 'partial' : 'stub';
  if (words < 60) return 'partial';
  return 'solid';
}

/**
 * Status efektif sebuah entri: nilai yang ditetapkan penulis bila ada, jika tidak
 * saran otomatis. `suggested: true` menandai bahwa ini masih tebakan (belum
 * dideklarasikan) sehingga UI bisa menampilkannya sebagai "disarankan".
 */
export function effectiveStatus(entry: CodexEntry): { status: WorldStatus; suggested: boolean } {
  if (entry.worldStatus) return { status: entry.worldStatus, suggested: false };
  return { status: suggestStatus(entry), suggested: true };
}

/** Pecah catatan `todo` multi-baris jadi daftar item (baris kosong dibuang). */
export function parseTodos(todo?: string): string[] {
  if (!todo) return [];
  return todo
    .split('\n')
    .map(s => s.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}

export interface CategoryCompleteness {
  category: string; // slug
  label: string;
  total: number;
  solid: number;
  partial: number;
  stub: number;
}

export interface StubEntry {
  id: number;
  name: string;
  category: string;
  categoryLabel: string;
  /** true bila status 'stub' berasal dari saran (belum dideklarasikan penulis). */
  suggested: boolean;
}

export interface TodoItem {
  entryId: number;
  entryName: string;
  text: string;
}

export interface CompletenessReport {
  total: number;
  solid: number;
  partial: number;
  stub: number;
  /** Persentase entri yang sudah 'solid' (0–100, dibulatkan). */
  solidPercent: number;
  byCategory: CategoryCompleteness[];
  stubs: StubEntry[];
  todos: TodoItem[];
}

/**
 * Bangun laporan kelengkapan dari daftar entri. `labelOf` me-resolve slug kategori →
 * label tampil (mis. `getCategoryLabel(cat, categories)` dari `codexCategories.ts`);
 * default identitas agar lib bebas dependensi & mudah diuji.
 */
export function buildCompletenessReport(
  entries: CodexEntry[],
  labelOf: (category: string) => string = c => c,
): CompletenessReport {
  const byCat = new Map<string, CategoryCompleteness>();
  const stubs: StubEntry[] = [];
  const todos: TodoItem[] = [];
  let solid = 0, partial = 0, stub = 0;

  for (const entry of entries) {
    const { status, suggested } = effectiveStatus(entry);
    const cat = entry.category;
    const label = labelOf(cat);

    let bucket = byCat.get(cat);
    if (!bucket) {
      bucket = { category: cat, label, total: 0, solid: 0, partial: 0, stub: 0 };
      byCat.set(cat, bucket);
    }
    bucket.total += 1;
    bucket[status] += 1;

    if (status === 'solid') solid += 1;
    else if (status === 'partial') partial += 1;
    else {
      stub += 1;
      if (entry.id != null) {
        stubs.push({ id: entry.id, name: entry.name, category: cat, categoryLabel: label, suggested });
      }
    }

    if (entry.id != null) {
      for (const text of parseTodos(entry.todo)) {
        todos.push({ entryId: entry.id, entryName: entry.name, text });
      }
    }
  }

  const total = entries.length;
  const byCategory = Array.from(byCat.values()).sort(
    (a, b) => b.stub - a.stub || b.total - a.total || a.label.localeCompare(b.label, 'id'),
  );
  // Entri paling "mentah" dulu (rangka yang dideklarasikan sebelum yang cuma disarankan),
  // lalu alfabetis — agar daftar tindakan stabil & bisa diprediksi.
  stubs.sort(
    (a, b) => Number(a.suggested) - Number(b.suggested) || a.name.localeCompare(b.name, 'id'),
  );

  return {
    total,
    solid,
    partial,
    stub,
    solidPercent: total > 0 ? Math.round((solid / total) * 100) : 0,
    byCategory,
    stubs,
    todos,
  };
}
