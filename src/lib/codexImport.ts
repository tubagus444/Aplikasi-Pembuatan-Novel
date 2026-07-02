/**
 * Engine parser "teks terstruktur → calon entri Codex" (deterministik, nol token).
 *
 * Dipakai bersama oleh dua jalur:
 *   1. Migrasi sekali — mengubah berkas lore Markdown jadi entri untuk file impor proyek.
 *   2. Paste-quick-add — pengguna menempel satu blok teks di form Codex → field terisi.
 *
 * Bukan sinkronisasi: hasilnya SELALU ditinjau pengguna sebelum disimpan, dan jalur
 * penyimpanan tetap `add` (tak pernah update/hapus entri lama). Lihat
 * RENCANA-FITUR-WORLDBUILDING.md #7.
 */

export interface ParsedCodexEntry {
  name: string;
  aliases: string[];
  category: string; // slug; diisi dari opts.defaultCategory (default 'other')
  description: string;
  tags: string[];
  /** Level heading sumber (1–6). 0 = blok teks tanpa heading. */
  headingLevel: number;
  /** true bila heading tampak seperti judul bagian (mis. "Ringkasan"), bukan entitas. */
  structural: boolean;
}

export interface ParseCodexOptions {
  /** Slug kategori default untuk semua entri hasil. Default 'other'. */
  defaultCategory?: string;
  /** Tag yang ditempelkan ke semua entri (mis. penanda file sumber). */
  defaultTags?: string[];
  /** Buang entri yang terdeteksi struktural dari hasil. Default false. */
  dropStructural?: boolean;
}

const NAME_CAP = 200;
const DESC_CAP = 4000;
const ALIAS_CAP = 10;
const ALIAS_LEN_CAP = 80;
const TAG_CAP = 40;
const FALLBACK_CATEGORY = 'other';

/** Heading yang biasanya penanda bagian/struktur, bukan sebuah entitas lore. */
const STRUCTURAL_RE =
  /^(ringkasan|gambaran umum|pengantar|pendahuluan|penutup|kesimpulan|daftar isi|ikhtisar|catatan|bagian\b|layer\b|peta\b|glosarium|contoh|tabel|lampiran|referensi)/i;

/** Buang penanda emphasis Markdown (**tebal**, _miring_, `kode`) tapi pertahankan teksnya. */
function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/(^|[^\w])_(.+?)_($|[^\w])/g, '$1$2$3')
    .replace(/`([^`]*)`/g, '$1');
}

/** Buang emoji/simbol piktografik yang jamak mengawali heading lore. */
function stripEmoji(s: string): string {
  return s.replace(/[\p{Extended_Pictographic}️☀-➿]/gu, '');
}

/** Bersihkan sebuah baris heading jadi teks polos (tanpa #, emoji, emphasis, escape). */
function cleanHeadingText(raw: string): string {
  let s = raw.replace(/^#{1,6}\s*/, '');
  s = stripInlineMarkdown(s);
  s = stripEmoji(s);
  s = s.replace(/\\([.\-()#*_])/g, '$1'); // unescape "\." "\-" dst
  // buang penomoran depan: "1. " / "2) " / bertingkat "4.0 " / "11.3.2 "
  s = s.replace(/^\s*(?:\d+\.\d+(?:\.\d+)*|\d+[.)])\s+/, '');
  return s.trim();
}

function truncateWords(s: string, cap: number): string {
  if (s.length <= cap) return s;
  const cut = s.slice(0, cap);
  const sp = cut.lastIndexOf(' ');
  return (sp > cap * 0.5 ? cut.slice(0, sp) : cut).trim();
}

function dedupeAliases(list: string[], name: string): string[] {
  const seen = new Set<string>();
  const lowerName = name.trim().toLowerCase();
  const out: string[] = [];
  for (const raw of list) {
    const a = raw.trim().slice(0, ALIAS_LEN_CAP);
    if (!a) continue;
    const key = a.toLowerCase();
    if (key === lowerName || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= ALIAS_CAP) break;
  }
  return out;
}

/**
 * Pisahkan teks heading yang sudah bersih jadi nama utama + alias.
 * Menangkap alias dari sufiks dash ("Keldrun — Dwarf") dan tanda kurung ("Manusia (Human)").
 */
function splitNameAliases(cleaned: string): { name: string; aliases: string[] } {
  const aliases: string[] = [];
  let s = cleaned
    .replace(/\(([^)]+)\)/g, (_m, inner: string) => {
      aliases.push(inner.trim());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();

  const parts = s.split(/\s+[—–-]\s+/);
  let name = s;
  if (parts.length > 1) {
    name = parts[0].trim();
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].trim()) aliases.push(parts[i].trim());
    }
  }
  return { name: name.slice(0, NAME_CAP), aliases: dedupeAliases(aliases, name) };
}

/** Bersihkan badan teks jadi deskripsi Codex yang enak dibaca (ratakan tabel, buang emphasis). */
function cleanBody(lines: string[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    let line = raw.replace(/\r$/, '');
    // baris pemisah tabel ("| --- | --- |") → buang
    if (/\|/.test(line) && /^[\s|:-]+$/.test(line) && line.includes('-')) continue;
    // baris tabel → gabung sel dengan " · "
    if (/^\s*\|.*\|\s*$/.test(line)) {
      line = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length)
        .join(' · ');
    }
    line = line.replace(/^\s*>\s?/, ''); // blockquote
    line = line.replace(/^\s*[-*+]\s+/, '• '); // bullet → •
    line = stripInlineMarkdown(line);
    line = line.replace(/\\([.\-()#*_])/g, '$1'); // unescape
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, DESC_CAP);
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const v = (t ?? '').trim().slice(0, TAG_CAP);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= ALIAS_CAP) break;
  }
  return out;
}

/** Blok teks tanpa heading → satu entri (baris pertama = nama, sisanya = deskripsi). */
function blobToEntry(
  lines: string[],
  category: string,
  tags: string[],
): ParsedCodexEntry | null {
  const firstIdx = lines.findIndex((l) => l.trim().length);
  if (firstIdx === -1) return null;

  const cleanedFirst = cleanHeadingText(lines[firstIdx].trim());
  const firstIsSentence = cleanedFirst.length > 80;
  const nameBasis = firstIsSentence ? truncateWords(cleanedFirst, 80) : cleanedFirst;
  const { name, aliases } = splitNameAliases(nameBasis);
  if (!name) return null;

  // Bila baris pertama sebenarnya kalimat panjang, jangan buang — ikutkan ke deskripsi.
  const bodyStart = firstIsSentence ? firstIdx : firstIdx + 1;
  const description = cleanBody(lines.slice(bodyStart));

  return {
    name,
    aliases,
    category,
    description,
    tags: [...tags],
    headingLevel: 0,
    structural: false,
  };
}

/**
 * Parse teks Markdown/polos jadi daftar calon entri Codex.
 *
 * Aturan: setiap heading ATX (`#`..`######`) mengawali satu entri; badannya = teks
 * sampai heading berikutnya (level apa pun). Teks tanpa heading sama sekali jadi satu
 * entri tunggal. Nol token, murni deterministik.
 */
export function parseCodexMarkdown(
  text: string,
  opts: ParseCodexOptions = {},
): ParsedCodexEntry[] {
  const category = opts.defaultCategory?.trim() || FALLBACK_CATEGORY;
  const tags = normalizeTags(opts.defaultTags);
  if (!text || !text.trim()) return [];

  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const headingIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s+\S/.test(lines[i])) headingIdx.push(i);
  }

  let entries: ParsedCodexEntry[] = [];

  if (headingIdx.length === 0) {
    const one = blobToEntry(lines, category, tags);
    if (one) entries.push(one);
  } else {
    for (let h = 0; h < headingIdx.length; h++) {
      const start = headingIdx[h];
      const end = h + 1 < headingIdx.length ? headingIdx[h + 1] : lines.length;
      const headingLine = lines[start];
      const level = (headingLine.match(/^#+/)?.[0] ?? '#').length;
      const { name, aliases } = splitNameAliases(cleanHeadingText(headingLine));
      if (!name) continue;
      const description = cleanBody(lines.slice(start + 1, end));
      entries.push({
        name,
        aliases,
        category,
        description,
        tags: [...tags],
        headingLevel: level,
        // struktural = nama seperti judul bagian, ATAU tanpa badan sama sekali
        // (heading pemisah yang langsung diikuti sub-heading).
        structural: STRUCTURAL_RE.test(name) || description.length === 0,
      });
    }
  }

  if (opts.dropStructural) entries = entries.filter((e) => !e.structural);
  return entries;
}
