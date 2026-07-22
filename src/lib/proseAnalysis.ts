/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analitik prosa — murni lokal, deterministik & TANPA AI (nol token).
 *
 * Dua lapis:
 *   1. `analyzeProse(text, lang)` — metrik gaya SATU potong teks (keterbacaan,
 *      kalimat panjang, verba pasif, kata keterangan). Dipakai bersama oleh
 *      panel editor (ProseInsights, per-bab) dan laporan seluruh naskah.
 *   2. `detectEchoWords` + `buildProseReport` — analitik LINTAS-BAB: kata muleti
 *      (overused/echo), rasio dialog (sinyal pacing), dan agregat manuskrip.
 *
 * Bekerja atas TEKS POLOS (HTML sudah di-strip oleh pemanggil), selaras dengan
 * mesin analitik lain (lihat `continuity.ts`).
 */

import { ProseMetrics } from '@/src/types';

export type ProseLanguage = 'en' | 'id';

// --- Heuristik verba pasif bahasa Indonesia (tanpa kamus/library) ---
// Tujuannya presisi, bukan kelengkapan: lebih baik melewatkan beberapa daripada
// salah menandai kata umum sebagai pasif (false positive).

// Kata berawalan "di-" yang BUKAN verba pasif (nomina/adjektiva/keterangan umum).
const DI_NON_PASSIVE = new Set([
  'dingin', 'dinding', 'dinas', 'dini', 'diam', 'diktator', 'dilema', 'dimensi',
  'direktur', 'diskusi', 'diskon', 'distrik', 'divisi', 'dividen', 'dialog',
  'diagram', 'diameter', 'diare', 'diet', 'dirinya', 'dingklik',
  'dinamis', 'dinosaurus', 'diploma', 'diktat', 'diksi',
]);

// Kata berawalan "ter-" yang BUKAN verba pasif (superlatif/adjektiva/keterangan).
const TER_NON_PASSIVE = new Set([
  // superlatif (ter- + adjektiva)
  'terbaik', 'terbesar', 'tertinggi', 'terkecil', 'tercepat', 'terindah',
  'terburuk', 'terkuat', 'terlemah', 'termuda', 'tertua', 'terpanjang',
  'terpendek', 'terbanyak', 'terdekat', 'terjauh', 'termahal', 'termurah',
  'terbaru', 'terlama', 'terdahulu', 'terhebat', 'ternama', 'terkemuka',
  'terpenting', 'terkenal',
  // adjektiva/keterangan umum
  'terang', 'teratur', 'terampil', 'terlalu', 'terutama', 'tertentu',
  'terima', 'teringat', 'teras', 'teropong', 'terompet', 'teratai',
  'terminal', 'teritori', 'terjemah', 'teri', 'teh',
]);

// Verba pasif "di-" tanpa sufiks -kan/-i yang sering muncul dalam prosa.
const DI_COMMON_PASSIVE = new Set([
  'dimakan', 'diminum', 'dibaca', 'ditulis', 'dilihat', 'didengar', 'dibawa',
  'diambil', 'dibuat', 'dikirim', 'ditemukan', 'dipakai', 'digunakan',
  'dipukul', 'ditendang', 'dipegang', 'dibunuh', 'diserang', 'dikejar',
  'ditangkap', 'dibuang', 'ditarik', 'didorong', 'dipanggil', 'dikenal',
  'ditahan', 'dijaga', 'dijual', 'dibeli', 'dikunci', 'ditutup', 'dibuka',
]);

// Verba pasif/resultatif "ter-" umum (ter- sangat ambigu, jadi pakai daftar).
const TER_COMMON_PASSIVE = new Set([
  'terbawa', 'terjatuh', 'terlihat', 'terdengar', 'tertidur', 'terbangun',
  'terluka', 'terlempar', 'terhempas', 'tersandung', 'tergeletak', 'terbaring',
  'terjebak', 'terperangkap', 'tertangkap', 'terbunuh', 'tertusuk', 'terkena',
  'tersentuh', 'terdorong', 'terangkat', 'terhapus', 'tertulis', 'terpasang',
  'terbakar', 'tersisa', 'terpaksa', 'terhanyut', 'terseret', 'tertimpa',
]);

const ID_ADVERBS = new Set([
  'sangat', 'amat', 'sekali', 'agak', 'paling', 'sungguh', 'begitu', 'terlalu',
  'cukup', 'hampir', 'selalu', 'sering', 'jarang', 'kadang', 'kadang-kadang',
  'biasanya', 'segera', 'tiba-tiba', 'perlahan', 'diam-diam', 'benar-benar',
  'betul-betul', 'secara', 'rupanya', 'tampaknya', 'sepertinya',
]);

// Buang tanda baca di awal/akhir, pertahankan tanda hubung internal (mis. "benar-benar").
function cleanToken(w: string): string {
  return w.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

function isPassiveID(w: string): boolean {
  if (w.length < 5) return false; // "dia", "diri", "diam", "dini" tersaring di sini
  if (w.startsWith('di')) {
    if (DI_NON_PASSIVE.has(w)) return false;
    // di- + sufiks verba (-kan/-i) → hampir pasti pasif; atau verba pasif umum
    if (/^di[a-z]{2,}(kan|i)$/.test(w)) return true;
    return DI_COMMON_PASSIVE.has(w);
  }
  if (w.startsWith('ter') && w.length >= 6) {
    if (TER_NON_PASSIVE.has(w)) return false;
    // ter- + sufiks verba, atau verba resultatif umum (daftar)
    return /^ter[a-z]{2,}(kan|i)$/.test(w) || TER_COMMON_PASSIVE.has(w);
  }
  return false;
}

const EMPTY_METRICS: ProseMetrics = {
  wordCount: 0,
  sentenceCount: 0,
  avgSentenceLength: 0,
  longSentences: 0,
  passiveVoiceCount: 0,
  adverbCount: 0,
  readabilityScore: 0,
};

export interface TokenizedChapter extends ProseChapter {
  rawWords: string[];
  cleanWords: string[];
  sentences: string[];
  syllables: number;
}

export function tokenizeChapter(ch: ProseChapter): TokenizedChapter {
  const clean = (ch.content || '').trim();
  const rawWords = clean ? clean.split(/\s+/) : [];
  const cleanWords = rawWords.map(cleanToken);
  const sentences = clean ? clean.split(/[.!?]+/).filter((s) => s.trim().length > 0) : [];
  const syllables = clean.toLowerCase().match(/[aeiouy]+/g)?.length || 0;
  
  return { ...ch, rawWords, cleanWords, sentences, syllables };
}

export function analyzeTokenizedProse(
  t: Pick<TokenizedChapter, 'rawWords' | 'cleanWords' | 'sentences' | 'syllables'>,
  language: ProseLanguage
): ProseMetrics {
  const { rawWords, cleanWords, sentences, syllables } = t;
  if (!rawWords.length) return { ...EMPTY_METRICS };

  let adverbs = 0;
  let passiveCount = 0;
  
  const validCleanWords = cleanWords.filter(Boolean);

  if (language === 'en') {
    adverbs = validCleanWords.filter((w) => w.endsWith('ly')).length;
    const passiveWords = ['was', 'were', 'been', 'being', 'is', 'am', 'are'];
    passiveCount = validCleanWords.filter(
      (w, i) => passiveWords.includes(w) && validCleanWords[i + 1]?.endsWith('ed'),
    ).length;
  } else {
    adverbs = validCleanWords.filter((w) => ID_ADVERBS.has(w)).length;
    passiveCount = validCleanWords.filter(isPassiveID).length;
  }

  const longSentences = sentences.filter((s) => s.trim().split(/\s+/).length > 25).length;

  const wordCount = rawWords.length;
  const sentenceCount = sentences.length;
  const readability = Math.max(0, Math.min(100, Math.round(
    206.835 - 1.015 * (wordCount / (sentenceCount || 1)) - 84.6 * (syllables / wordCount),
  )));

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength: Math.round(wordCount / (sentenceCount || 1)),
    longSentences,
    passiveVoiceCount: passiveCount,
    adverbCount: adverbs,
    readabilityScore: readability,
  };
}

/**
 * Metrik gaya untuk satu potong TEKS POLOS. Identik dengan perhitungan lama di
 * ProseInsights (Flesch Reading Ease disederhanakan, kalimat > 25 kata = panjang).
 */
export function analyzeProse(text: string, language: ProseLanguage): ProseMetrics {
  const ch: ProseChapter = { id: 0, title: '', content: text };
  const tokenized = tokenizeChapter(ch);
  return analyzeTokenizedProse(tokenized, language);
}

// --- Kata muleti / echo words (lintas-bab) ---

// Stopword frekuensi-tinggi yang tak informatif → dikecualikan dari deteksi echo.
const STOPWORDS_ID = new Set([
  'yang', 'dan', 'dengan', 'untuk', 'pada', 'dari', 'dalam', 'adalah', 'akan',
  'tidak', 'ini', 'itu', 'atau', 'juga', 'sudah', 'saat', 'ketika', 'karena',
  'tapi', 'tetapi', 'namun', 'lalu', 'kemudian', 'seperti', 'saja', 'masih',
  'hanya', 'bisa', 'dapat', 'telah', 'oleh', 'para', 'sebuah', 'satu', 'dua',
  'apa', 'siapa', 'bagaimana', 'mengapa', 'kita', 'kami', 'kalian', 'mereka',
  'dia', 'aku', 'saya', 'kamu', 'engkau', 'anda', 'nya', 'pun', 'agar',
  'supaya', 'hingga', 'sampai', 'antara', 'atas', 'bawah', 'tersebut', 'yaitu',
  'bahwa', 'maka', 'jika', 'kalau', 'sebagai', 'ada', 'ialah', 'yang', 'ke',
  'di', 'itu', 'ini', 'sang', 'begitu', 'setelah', 'sebelum', 'tanpa', 'demi',
  'lebih', 'sangat', 'semua', 'setiap', 'lagi', 'pula', 'sendiri', 'menjadi',
  'sedang', 'harus', 'ingin', 'mau', 'bukan', 'belum', 'jadi', 'tak', 'tuk',
]);

const STOPWORDS_EN = new Set([
  'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
  'his', 'her', 'she', 'him', 'they', 'them', 'their', 'from', 'was', 'were',
  'are', 'been', 'being', 'has', 'had', 'did', 'does', 'would', 'could',
  'should', 'will', 'shall', 'can', 'may', 'might', 'must', 'into', 'onto',
  'out', 'off', 'over', 'under', 'again', 'then', 'than', 'there', 'here',
  'when', 'where', 'what', 'which', 'who', 'whom', 'how', 'why', 'said', 'says',
  'about', 'because', 'while', 'though', 'although', 'after', 'before', 'until',
  'some', 'such', 'only', 'very', 'just', 'also', 'even', 'like', 'much',
  'more', 'most', 'own', 'same', 'other', 'another', 'each', 'every', 'all',
  'any', 'both', 'few', 'himself', 'herself', 'itself', 'themselves',
]);

export interface EchoWord {
  word: string;
  /** Total kemunculan di seluruh manuskrip. */
  total: number;
  /** Berapa banyak bab yang memuat kata ini. */
  chapters: number;
  /** Kepadatan: kemunculan per 1000 kata (dibulatkan 2 desimal). */
  per1000: number;
}

export interface ProseChapter {
  id: number;
  title: string;
  /** Teks polos (tanpa HTML). */
  content: string;
}

export interface EchoOptions {
  language: ProseLanguage;
  /** Kata yang dikecualikan (mis. nama+alias Codex, sudah di-lowercase). */
  excludeWords?: Set<string>;
  /** Panjang minimal kata agar dipertimbangkan. Default 4. */
  minLength?: number;
  /** Total kemunculan minimal agar dianggap "muleti". Default 6. */
  minTotal?: number;
  /** Jumlah kata teratas yang dikembalikan. Default 25. */
  limit?: number;
}

/**
 * Deteksi kata muleti / echo lintas-naskah: kata konten (bukan stopword, bukan
 * nama Codex) yang muncul paling sering. Diurutkan menurut kepadatan (per 1000
 * kata) lalu total, agar naskah panjang tak selalu didominasi kata paling umum.
 */
export function detectEchoWords(chapters: Pick<TokenizedChapter, 'cleanWords'>[], opts: EchoOptions): EchoWord[] {
  const minLength = opts.minLength ?? 4;
  const minTotal = opts.minTotal ?? 6;
  const limit = opts.limit ?? 25;
  const stop = opts.language === 'en' ? STOPWORDS_EN : STOPWORDS_ID;
  const exclude = opts.excludeWords;

  const total = new Map<string, number>();
  const chapterHits = new Map<string, Set<number>>();
  let totalWords = 0;

  chapters.forEach((ch, idx) => {
    for (const w of ch.cleanWords) {
      if (!w) continue;
      totalWords++;
      if (w.length < minLength) continue;
      if (stop.has(w)) continue;
      if (exclude?.has(w)) continue;
      total.set(w, (total.get(w) ?? 0) + 1);
      let set = chapterHits.get(w);
      if (!set) { set = new Set(); chapterHits.set(w, set); }
      set.add(idx);
    }
  });

  const denom = totalWords || 1;
  const rows: EchoWord[] = [];
  for (const [word, count] of total) {
    if (count < minTotal) continue;
    rows.push({
      word,
      total: count,
      chapters: chapterHits.get(word)!.size,
      per1000: Math.round((count / denom) * 1000 * 100) / 100,
    });
  }

  rows.sort((a, b) => b.per1000 - a.per1000 || b.total - a.total || a.word.localeCompare(b.word));
  return rows.slice(0, limit);
}

export interface ProximityEcho {
  /** Kunci stabil untuk React (bab + posisi kemunculan kedua). */
  id: string;
  word: string;
  chapterId: number;
  chapterTitle: string;
  /** Indeks bab (0-based, urutan manuskrip). */
  chapterIndex: number;
  /** Jumlah kata antara dua kemunculan yang berdekatan (makin kecil makin janggal). */
  distance: number;
  /** Cuplikan di sekitar kemunculan KEDUA — untuk ditampilkan & dilompati (jumpToText). */
  excerpt: string;
}

export interface ProximityOptions {
  language: ProseLanguage;
  /** Kata yang dikecualikan (mis. nama+alias Codex, sudah di-lowercase). */
  excludeWords?: Set<string>;
  /** Panjang minimal kata agar dipertimbangkan. Default 4. */
  minLength?: number;
  /** Jendela maksimum (dalam kata) antar dua kemunculan agar dianggap echo. Default 40. */
  window?: number;
  /** Jumlah temuan teratas yang dikembalikan. Default 40. */
  limit?: number;
}

/** Cuplikan raw di sekitar sebuah indeks kata (untuk tampilan + pencarian sorot). */
function makeExcerpt(rawWords: string[], centerIdx: number, before = 3, after = 4): string {
  const start = Math.max(0, centerIdx - before);
  const end = Math.min(rawWords.length, centerIdx + after + 1);
  return rawWords.slice(start, end).join(' ').trim();
}

/**
 * Deteksi echo BERDEKATAN: kata konten yang sama muncul dua kali dalam jendela
 * pendek (default 40 kata) — pengulangan yang terasa janggal saat dibaca, yang
 * lolos dari deteksi frekuensi global. Diurut menurut jarak menaik (terdekat =
 * paling menonjol). Nol token, per-bab.
 */
export function detectProximityEchoes(chapters: Pick<TokenizedChapter, 'id' | 'title' | 'rawWords' | 'cleanWords'>[], opts: ProximityOptions): ProximityEcho[] {
  const minLength = opts.minLength ?? 4;
  const window = opts.window ?? 40;
  const limit = opts.limit ?? 40;
  const stop = opts.language === 'en' ? STOPWORDS_EN : STOPWORDS_ID;
  const exclude = opts.excludeWords;

  const echoes: ProximityEcho[] = [];

  chapters.forEach((ch, chapterIndex) => {
    const rawWords = ch.rawWords;
    const lastSeen = new Map<string, number>();
    ch.cleanWords.forEach((w, i) => {
      if (!w || w.length < minLength) return;
      if (stop.has(w) || exclude?.has(w)) return;
      const prev = lastSeen.get(w);
      if (prev != null) {
        const distance = i - prev;
        if (distance <= window) {
          echoes.push({
            id: `${ch.id}:${i}:${w}`,
            word: w,
            chapterId: ch.id,
            chapterTitle: ch.title,
            chapterIndex,
            distance,
            excerpt: makeExcerpt(rawWords, i),
          });
        }
      }
      lastSeen.set(w, i);
    });
  });

  echoes.sort((a, b) => a.distance - b.distance || a.chapterIndex - b.chapterIndex || a.word.localeCompare(b.word));
  return echoes.slice(0, limit);
}

/**
 * Rasio dialog: porsi kata yang berada di dalam tanda kutip (lurus atau
 * melengkung) terhadap total kata. Sinyal pacing kasar — bab dominan-dialog
 * vs dominan-narasi. Nilai 0–1.
 */
export function dialogueRatio(text: string): number {
  const clean = (text || '').trim();
  if (!clean) return 0;
  const totalWords = clean.split(/\s+/).filter(Boolean).length;
  if (!totalWords) return 0;

  let inside = 0;
  // Cocokkan segmen di antara pasangan kutip: "…" atau “…”.
  const re = /"([^"]*)"|“([^”]*)”/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const seg = (m[1] ?? m[2] ?? '').trim();
    if (seg) inside += seg.split(/\s+/).filter(Boolean).length;
  }
  return Math.min(1, inside / totalWords);
}

export interface ChapterProseRow {
  id: number;
  title: string;
  /** Indeks bab (0-based, urutan manuskrip). */
  index: number;
  metrics: ProseMetrics;
  /** Porsi kata di dalam dialog (0–1). */
  dialogueRatio: number;
}

export interface ProseReport {
  chapters: ChapterProseRow[];
  totalWords: number;
  /** Rata-rata keterbacaan tertimbang jumlah kata (0–100). */
  avgReadability: number;
  /** Rata-rata panjang kalimat seluruh naskah. */
  avgSentenceLength: number;
  totalPassive: number;
  totalAdverbs: number;
  totalLongSentences: number;
  echoWords: EchoWord[];
  proximityEchoes: ProximityEcho[];
  chapterCount: number;
}

/** Bangun laporan prosa seluruh naskah dari bab (teks polos, terurut). */
export function buildProseReport(
  chapters: ProseChapter[],
  language: ProseLanguage,
  excludeWords?: Set<string>,
): ProseReport {
  const tokenized = chapters.map(tokenizeChapter);

  const rows: ChapterProseRow[] = tokenized.map((ch, index) => ({
    id: ch.id,
    title: ch.title,
    index,
    metrics: analyzeTokenizedProse(ch, language),
    dialogueRatio: dialogueRatio(ch.content),
  }));

  let totalWords = 0;
  let readabilityWeighted = 0;
  let totalSentences = 0;
  let totalPassive = 0;
  let totalAdverbs = 0;
  let totalLongSentences = 0;

  for (const r of rows) {
    const wc = r.metrics.wordCount;
    totalWords += wc;
    readabilityWeighted += r.metrics.readabilityScore * wc;
    totalSentences += r.metrics.sentenceCount;
    totalPassive += r.metrics.passiveVoiceCount;
    totalAdverbs += r.metrics.adverbCount;
    totalLongSentences += r.metrics.longSentences;
  }

  return {
    chapters: rows,
    totalWords,
    avgReadability: totalWords ? Math.round(readabilityWeighted / totalWords) : 0,
    avgSentenceLength: totalSentences ? Math.round(totalWords / totalSentences) : 0,
    totalPassive,
    totalAdverbs,
    totalLongSentences,
    echoWords: detectEchoWords(tokenized, { language, excludeWords }),
    proximityEchoes: detectProximityEchoes(tokenized, { language, excludeWords }),
    chapterCount: chapters.length,
  };
}
