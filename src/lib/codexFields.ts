/**
 * Template field per kategori Codex (#17) — logika murni, tak menyentuh DB/UI.
 *
 * Skema field (definisi) hidup di `CustomCategory.fields` (tabel `codexCategories`);
 * NILAI-nya di `CodexEntry.customFields` sebagai array TER-DENORMALISASI
 * (`{ key, label, value }`). Denormalisasi label saat simpan membuat SEMUA jalur baca
 * (KB AI, ekspor Markdown, detail/kartu) self-contained — tak perlu resolusi kategori,
 * jadi tak ada penerusan kategori ke jalur AI (jaga cache prompt byte-identik).
 *
 * Konsekuensi yang disengaja (v1): mengganti `label` sebuah field TIDAK mengubah entri
 * lama sampai entri disimpan ulang; berpindah kategori lalu menyimpan membuang nilai
 * kategori sebelumnya (dibangun ulang dari definisi kategori aktif). Keduanya diterima
 * demi kesederhanaan & determinisme.
 */
import type { CodexEntry, CategoryFieldDef, CustomFieldValue } from '@/src/types';
import { slugify } from '@/src/lib/codexCategories';

/** Buat key field unik & stabil dari label, terhadap key yang sudah ada di kategori. */
export function slugifyFieldKey(label: string, existingKeys: string[]): string {
  const base = slugify(label) || 'field';
  if (!existingKeys.includes(base)) return base;
  let i = 2;
  while (existingKeys.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Nilai field non-kosong pada entri, mempertahankan urutan tersimpan. */
export function resolveFieldValues(entry: Pick<CodexEntry, 'customFields'>): CustomFieldValue[] {
  return (entry.customFields ?? []).filter(
    (f) => f && typeof f.value === 'string' && f.value.trim() !== ''
  );
}

/** Peta key→value dari entri, untuk inisialisasi input di CodexForm. */
export function fieldValueMap(
  entry?: Pick<CodexEntry, 'customFields'> | null
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of entry?.customFields ?? []) {
    if (f && typeof f.key === 'string') map[f.key] = f.value ?? '';
  }
  return map;
}

/**
 * Bangun array nilai ter-denormalisasi dari definisi kategori + peta nilai (dipakai
 * CodexForm saat simpan). Hanya field ber-nilai non-kosong yang disertakan; urutan
 * mengikuti urutan `defs` agar deterministik.
 */
export function buildFieldValues(
  defs: CategoryFieldDef[] | undefined,
  values: Record<string, string>
): CustomFieldValue[] {
  if (!defs?.length) return [];
  const out: CustomFieldValue[] = [];
  for (const d of defs) {
    const raw = values[d.key];
    const v = (raw ?? '').trim();
    if (v) out.push({ key: d.key, label: d.label, value: v });
  }
  return out;
}

/**
 * Baris `Label: nilai` deterministik untuk KB AI. Self-contained (membaca entri saja).
 * String kosong bila tak ada field — pemanggil memutuskan cara menempel.
 */
export function formatFieldsForAI(entry: Pick<CodexEntry, 'customFields'>): string {
  const vals = resolveFieldValues(entry);
  if (!vals.length) return '';
  return vals.map((f) => `${f.label}: ${f.value}`).join('\n');
}

/** Blok Markdown (definition-list) untuk ekspor Codex. Kosong bila tak ada field. */
export function formatFieldsForMarkdown(entry: Pick<CodexEntry, 'customFields'>): string {
  const vals = resolveFieldValues(entry);
  if (!vals.length) return '';
  return vals.map((f) => `- **${f.label}:** ${f.value}`).join('\n');
}
