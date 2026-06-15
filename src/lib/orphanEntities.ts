/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deteksi "entitas yatim": nama-diri (Title Case) yang sering muncul di manuskrip
 * tetapi belum ada di Codex. Kebalikan dari Aho-Corasick (yang mencari nama yang
 * SUDAH ada). Murni heuristik, tanpa AI — instan & lokal.
 */

import { getCodexRegex } from '@/src/lib/utils';

export interface OrphanCandidate {
  /** Bentuk permukaan, mis. "Kael" atau "Kael Aldheim". */
  name: string;
  /** Total kemunculan di seluruh manuskrip. */
  count: number;
  /** Kemunculan "kuat" (kapital di tengah kalimat) — sinyal nama-diri. */
  strong: number;
  /** Cuplikan konteks dari kemunculan pertama yang kuat. */
  sample: string;
  /** ID bab tempat kandidat muncul. */
  chapterIds: number[];
}

export interface OrphanOptions {
  /** Frekuensi minimum agar kandidat ditampilkan (default 3). */
  minCount?: number;
  /** Nama (huruf kecil) yang diabaikan pengguna. */
  ignored?: Set<string>;
}

const INDONESIAN_PARTICLE = /(nya|ku|mu|lah|kah|pun|toh)$/;

// Kata umum yang kerap berhuruf kapital di awal kalimat / kata sapaan — bukan entitas.
const STOPWORDS = new Set<string>([
  // pronoun & penunjuk
  'aku', 'saya', 'kamu', 'kau', 'engkau', 'dia', 'ia', 'beliau', 'kami', 'kita', 'mereka',
  'ini', 'itu', 'sini', 'situ', 'sana',
  // konjungsi & penghubung awal kalimat
  'dan', 'atau', 'tapi', 'tetapi', 'namun', 'lalu', 'kemudian', 'setelah', 'sebelum',
  'ketika', 'saat', 'jika', 'kalau', 'karena', 'sebab', 'maka', 'sehingga', 'walau',
  'walaupun', 'meski', 'meskipun', 'agar', 'supaya', 'bahwa', 'sambil', 'selagi', 'sementara',
  // adverbia/partikel awal kalimat
  'juga', 'bahkan', 'hanya', 'sudah', 'telah', 'akan', 'sedang', 'masih', 'tidak', 'bukan',
  'ada', 'tak', 'tanpa', 'begitu', 'seperti', 'seolah', 'seakan', 'mungkin', 'pasti',
  'tiba', 'akhirnya', 'namun', 'oleh', 'untuk', 'dengan', 'pada', 'dari', 'dalam', 'tentang',
  // hari & bulan
  'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu',
  'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus',
  'september', 'oktober', 'november', 'desember',
  // sapaan/gelar umum (sering kapital tapi bukan entitas mandiri)
  'tuan', 'nyonya', 'nona', 'pak', 'bu', 'bapak', 'ibu',
  // bahasa Inggris yang sering bocor
  'the', 'and', 'but', 'he', 'she', 'they', 'it'
]);

// Title Case word, toleran apostrof/hubung di tengah. Min 2 huruf.
const WORD = '\\p{Lu}\\p{Ll}+(?:[\'’\\-]\\p{Ll}+)*';
const TOKEN_RE = new RegExp(`${WORD}(?:\\s+${WORD})*`, 'gu');

function stripParticle(lower: string): string {
  return lower.replace(INDONESIAN_PARTICLE, '');
}

/** Kumpulan istilah yang sudah dikenal Codex (nama+alias, beserta kata penyusunnya). */
function buildKnownSet(codexEntries: { name: string; aliases?: string[] }[]): Set<string> {
  const known = new Set<string>();
  for (const e of codexEntries) {
    const terms = [e.name, ...(e.aliases || [])];
    for (const t of terms) {
      if (!t) continue;
      const lower = t.toLowerCase().trim();
      if (!lower) continue;
      known.add(lower);
      // Tambahkan kata penyusun (≥3 huruf) agar "Kael" tak diusulkan saat entri
      // bernama "Kael Aldheim" sudah ada.
      for (const w of lower.split(/\s+/)) {
        if (w.length >= 3) known.add(w);
      }
    }
  }
  return known;
}

function isKnown(known: Set<string>, name: string): boolean {
  const lower = name.toLowerCase();
  if (known.has(lower)) return true;
  const stripped = stripParticle(lower);
  if (stripped !== lower && known.has(stripped)) return true;
  return false;
}

function isStopword(name: string): boolean {
  // Untuk nama multi-kata, anggap stopword hanya bila SEMUA kata adalah stopword.
  return name.toLowerCase().split(/\s+/).every(w => STOPWORDS.has(w));
}

function snippet(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 35);
  const end = Math.min(text.length, idx + len + 35);
  let s = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) s = '…' + s;
  if (end < text.length) s = s + '…';
  return s;
}

interface Acc { count: number; strong: number; sample: string; chapters: Set<number>; }

/**
 * Memindai bab-bab (teks polos, sudah di-strip HTML) dan mengembalikan kandidat
 * entitas yatim, terurut dari yang paling sering.
 */
export function findOrphanEntities(
  chapters: { id?: number; content: string }[],
  codexEntries: { name: string; aliases?: string[] }[],
  options?: OrphanOptions
): OrphanCandidate[] {
  const minCount = options?.minCount ?? 3;
  const ignored = options?.ignored ?? new Set<string>();
  const known = buildKnownSet(codexEntries);

  const acc = new Map<string, Acc>();

  for (const ch of chapters) {
    const text = ch.content || '';
    if (!text) continue;
    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      const surface = m[0];
      const idx = m.index;

      // Lihat karakter non-spasi sebelumnya (berhenti di awal/newline).
      let j = idx - 1;
      while (j >= 0 && (text[j] === ' ' || text[j] === '\t')) j--;
      const prevChar = j >= 0 ? text[j] : '\n';
      const strongContext = /[\p{Ll}\d,;]/u.test(prevChar);     // jelas di tengah kalimat
      const sentenceInitial = prevChar === '\n' || prevChar === '.' || prevChar === '!' || prevChar === '?';

      // Run Title Case yang diawali kalimat kerap menempelkan kata kapital pertama
      // (mis. "Konon Kael Aldheim"). Buang kata pertama itu agar nama tak terpecah.
      const words = surface.split(/\s+/);
      let candidate: string;
      let strong: boolean;
      if (strongContext) {
        candidate = surface; strong = true;
      } else if (sentenceInitial && words.length >= 2) {
        candidate = words.slice(1).join(' '); strong = true;
      } else {
        candidate = surface; strong = false;   // kata tunggal di awal kalimat / setelah kutip → lemah
      }

      let a = acc.get(candidate);
      if (!a) { a = { count: 0, strong: 0, sample: '', chapters: new Set() }; acc.set(candidate, a); }
      a.count++;
      if (strong) {
        a.strong++;
        if (!a.sample) a.sample = snippet(text, idx, surface.length);
      }
      if (ch.id != null) a.chapters.add(ch.id);
    }
  }

  const out: OrphanCandidate[] = [];
  for (const [name, a] of acc) {
    const lower = name.toLowerCase();
    if (ignored.has(lower)) continue;
    if (a.strong === 0) continue;          // hanya pernah di awal kalimat → kemungkinan kata umum
    if (a.count < minCount) continue;
    if (isKnown(known, name)) continue;
    if (isStopword(name)) continue;
    out.push({ name, count: a.count, strong: a.strong, sample: a.sample, chapterIds: [...a.chapters] });
  }

  out.sort((x, y) => (y.count - x.count) || (y.strong - x.strong) || x.name.localeCompare(y.name));
  return out;
}

/**
 * Mengumpulkan cuplikan konteks (window di sekitar tiap kemunculan nama) dari
 * manuskrip — untuk membekali enrichment AI dengan bukti dari teks asli.
 * Di-cap ketat agar hemat token & terprediksi.
 */
export function gatherEntityContext(
  chapters: { content: string }[],
  name: string,
  options?: { maxSnippets?: number; window?: number; maxChars?: number }
): string {
  const maxSnippets = options?.maxSnippets ?? 6;
  const window = options?.window ?? 180;
  const maxChars = options?.maxChars ?? 1500;

  let re: RegExp;
  try {
    re = getCodexRegex(name);
  } catch {
    return '';
  }

  const snippets: string[] = [];
  let total = 0;

  for (const ch of chapters) {
    const text = ch.content || '';
    if (!text) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      const start = Math.max(0, idx - Math.floor(window / 2));
      const end = Math.min(text.length, idx + m[0].length + Math.floor(window / 2));
      let s = text.slice(start, end).replace(/\s+/g, ' ').trim();
      if (start > 0) s = '…' + s;
      if (end < text.length) s = s + '…';
      snippets.push(s);
      total += s.length;
      if (m.index === re.lastIndex) re.lastIndex++; // jaga-jaga match nol-panjang
      if (snippets.length >= maxSnippets || total >= maxChars) return snippets.join('\n');
    }
  }

  return snippets.join('\n');
}
