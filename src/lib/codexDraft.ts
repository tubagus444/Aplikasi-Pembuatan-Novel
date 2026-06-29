import { CodexEntry } from '@/src/types';

/**
 * Protokol live-fill Lokakarya Codex (Fase 3).
 *
 * AI dipandu menutup balasannya — ketika punya informasi konkret tentang entitas
 * yang sedang digarap — dengan satu blok berpagar berlabel `codex-draft` berisi
 * JSON. Blok ini DISEMBUNYIKAN dari gelembung chat (lihat stripCodexDraft) dan
 * dipanen ke field draf (lihat parseCodexDraft) tanpa panggilan AI kedua.
 *
 * Hanya jalur Lokakarya yang mengirim instruksi ini (via ChatParams.extraSystem),
 * jadi chat biasa tak terpengaruh.
 */
export const WORKSHOP_DRAFT_INSTRUCTION = `
WORKSHOP OUTPUT PROTOCOL (Codex entry builder):
You are helping the writer build/refine ONE Codex entry through conversation.
Reply conversationally as usual. THEN, whenever you have concrete details about
the entity, append a fenced code block on its own lines at the very end:

\`\`\`codex-draft
{ "name": "...", "category": "...", "description": "...", "aliases": ["..."], "tags": ["..."] }
\`\`\`

Rules for the block:
- Include ONLY the JSON object, valid JSON, keys you are confident about. All keys optional.
- "category" must be one of: character, location, item, magic, event, other.
- "description" is the lore text stored in the Codex — write it polished and self-contained.
- Write all field values in the SAME LANGUAGE as the conversation.
- Never mention this block or its contents in your visible reply. Output it at most once, last.
- If you have nothing new to propose, omit the block entirely.
`.trim();

const BUILTIN_CATEGORIES = new Set(['character', 'location', 'item', 'magic', 'event', 'other']);

/** Field draf yang boleh diisi otomatis dari blok codex-draft. */
export type CodexDraftFields = Partial<Pick<CodexEntry, 'name' | 'category' | 'description' | 'aliases' | 'tags'>>;

function cleanStringArray(v: unknown, cap: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, cap);
  return out.length ? out : [];
}

/**
 * Ambil blok `codex-draft` terakhir yang LENGKAP (berpagar penutup) dari teks balasan
 * dan parse jadi field tersanitasi. Mengembalikan null bila tak ada blok valid.
 * `allowedCategories` (slug yang tersedia di proyek) memvalidasi kategori; bila tak
 * cocok, field category diabaikan agar tak menyetel slug yang tak dikenal.
 */
export function parseCodexDraft(text: string, allowedCategories?: string[]): CodexDraftFields | null {
  if (!text) return null;
  // Ambil kemunculan terakhir (AI mungkin menulis lebih dari satu lintas giliran).
  const re = /```codex-draft\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = re.exec(text)) !== null) last = match[1];
  if (last === null) return null;

  let raw: any;
  try {
    raw = JSON.parse(last.trim());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;

  const fields: CodexDraftFields = {};
  if (typeof raw.name === 'string' && raw.name.trim()) fields.name = raw.name.trim().slice(0, 200);
  if (typeof raw.description === 'string' && raw.description.trim()) {
    fields.description = raw.description.trim().slice(0, 4000);
  }
  if (typeof raw.category === 'string') {
    const cat = raw.category.trim().toLowerCase();
    const allowed = allowedCategories && allowedCategories.length ? new Set(allowedCategories) : BUILTIN_CATEGORIES;
    if (allowed.has(cat)) fields.category = cat;
  }
  const aliases = cleanStringArray(raw.aliases, 10);
  if (aliases) fields.aliases = aliases;
  const tags = cleanStringArray(raw.tags, 10);
  if (tags) fields.tags = tags;

  return Object.keys(fields).length ? fields : null;
}

/**
 * Buang blok codex-draft dari teks yang DITAMPILKAN ke pengguna — termasuk pagar
 * yang masih separuh ter-stream di akhir — agar JSON tak pernah terlihat di chat.
 */
export function stripCodexDraft(text: string): string {
  if (!text) return text;
  let out = text;
  // Blok lengkap atau separuh (dari label hingga akhir string).
  out = out.replace(/```codex-draft[\s\S]*$/i, '');
  // Pagar yang baru mulai diketik saat streaming, mis. "```c", "```codex-dra".
  out = out.replace(/```c[a-z-]*\s*$/i, '');
  return out.trimEnd();
}
