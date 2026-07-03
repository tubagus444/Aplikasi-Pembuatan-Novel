/**
 * Export Codex → Markdown (arah-balik "jembatan teks ⇄ Codex", satu arah).
 *
 * Gunanya berulang: cadangan lore yang terbaca, versioning di git, cetak/bagikan,
 * atau lanjut menyunting di editor favorit. Deterministik & nol token. Bukan sinkron:
 * tak ada jalur re-impor otomatis (lihat RENCANA-FITUR-WORLDBUILDING.md #7).
 *
 * Output dikelompokkan per kategori & diurutkan nama (A–Z) agar diff antar-ekspor stabil.
 */
import { BUILTIN_CATEGORIES, getCategoryLabel, type CategoryDef } from '@/src/lib/codexCategories';
import { formatFieldsForMarkdown } from '@/src/lib/codexFields';
import type { CodexEntry } from '@/src/types';

export interface CodexExportOptions {
  projectName?: string;
  /** Untuk urutan & label kategori (default: kategori bawaan). */
  categories?: CategoryDef[];
  /** Timestamp untuk baris meta (untuk tes deterministik). */
  now?: number;
  /**
   * Lapis "Kebenaran Tersembunyi": sertakan entri `hidden` (rahasia penulis).
   * Default `false` — ekspor adalah "world bible" yang bisa dibagikan, jadi entri
   * rahasia disaring. Field `secret` TAK PERNAH dicetak apa pun nilai opsi ini.
   */
  includeHidden?: boolean;
}

function entryBlock(e: CodexEntry): string {
  const lines: string[] = [`### ${e.name.trim()}`];
  const meta: string[] = [];
  if (e.aliases?.length) meta.push(`Alias: ${e.aliases.join(', ')}`);
  if (e.tags?.length) meta.push(`Tag: ${e.tags.join(', ')}`);
  if (meta.length) lines.push(`_${meta.join(' · ')}_`);
  lines.push('');
  lines.push((e.description ?? '').trim() || '_(tanpa deskripsi)_');
  // Template field per kategori (#17) — detail terstruktur sebagai definition-list.
  const fields = formatFieldsForMarkdown(e);
  if (fields) {
    lines.push('');
    lines.push(fields);
  }
  lines.push('');
  return lines.join('\n');
}

export function codexToMarkdown(allEntries: CodexEntry[], opts: CodexExportOptions = {}): string {
  const categories = opts.categories ?? BUILTIN_CATEGORIES;
  // Saring entri rahasia dari output pembaca kecuali diminta eksplisit.
  const entries = opts.includeHidden ? allEntries : allEntries.filter((e) => !e.hidden);
  const title = (opts.projectName || 'Tanpa Judul').trim();
  const date = new Date(opts.now ?? Date.now()).toISOString().slice(0, 10);
  const header = `# Codex — ${title}\n\n_Diekspor dari AetherScribe · ${entries.length} entri · ${date}_\n`;

  if (entries.length === 0) {
    return `${header}\n_(Tidak ada entri Codex.)_\n`;
  }

  // Urutan kategori: ikut daftar `categories`, lalu slug tak dikenal di akhir (alfabetis).
  const known = categories.map((c) => c.slug);
  const present = new Set(entries.map((e) => e.category));
  const unknown = [...present].filter((s) => !known.includes(s)).sort();
  const order = [...known.filter((s) => present.has(s)), ...unknown];

  const byCat = new Map<string, CodexEntry[]>();
  for (const e of entries) {
    const list = byCat.get(e.category) ?? [];
    list.push(e);
    byCat.set(e.category, list);
  }

  const sections: string[] = [];
  for (const slug of order) {
    const list = (byCat.get(slug) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
    if (!list.length) continue;
    const label = getCategoryLabel(slug, categories);
    sections.push(`## ${label}  (${list.length})\n\n${list.map(entryBlock).join('\n')}`);
  }

  return `${header}\n${sections.join('\n')}`.trimEnd() + '\n';
}
