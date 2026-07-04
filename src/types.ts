/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AIAction {
  id?: number;
  projectId: number;
  label: string;
  prompt: string;
  icon?: string;
}

export interface Snapshot {
  id?: number;
  chapterId: number;
  content: string;
  label: string;
  timestamp: number;
  /** true bila dibuat otomatis sebelum aksi destruktif (rewrite AI, replace-all, restore). */
  auto?: boolean;
}

export type TimelineEventType = 'plot' | 'character' | 'world' | 'subplot' | 'reveal' | 'other';

/**
 * Satu peristiwa pada timeline cerita (tabel `timeline`). Dipakai untuk menyusun
 * kronologi anti-plot-hole. `eventDate` adalah label waktu in-world bebas
 * (mis. "Hari 3", "Tahun 1024"); `chapterId` opsional menautkan ke bab.
 */
export interface TimelineEvent {
  id?: number;
  projectId: number;
  chapterId?: number;
  title: string;
  description: string;
  /** Label waktu in-world bebas, mis. "Hari 3, Pagi" atau "Musim Dingin Tahun 1024". */
  eventDate?: string;
  type: TimelineEventType;
  /** ID entri Codex (karakter/entitas) yang terlibat di peristiwa ini. */
  characterIds?: number[];
  /** Urutan manual pada timeline. */
  order: number;
}

export interface ProseMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  longSentences: number; // Sentences > 25 words
  passiveVoiceCount: number;
  adverbCount: number;
  readabilityScore: number; // 0-100
}

export interface Relationship {
  id?: number;
  projectId: number;
  sourceId: number; // CodexEntry ID
  targetId: number; // CodexEntry ID
  type: string; // e.g. "Enemy", "Lover", "Sibling"
  description?: string;
}

export type ChapterStatus = 'outline' | 'draft' | 'edit' | 'polish' | 'done';

export type ViewMode = 'write' | 'outline' | 'codex' | 'bible' | 'settings' | 'actions' | 'relationships' | 'guide' | 'errors' | 'brainstorm' | 'dashboard' | 'consistency' | 'timeline' | 'orphans' | 'continuity' | 'arc' | 'prose' | 'workshop' | 'search' | 'promises' | 'glossary' | 'completeness' | 'heatmap' | 'graph';

/**
 * Sasaran sesi Lokakarya Codex (viewMode 'workshop'): diskusi terfokus dengan AI
 * untuk membuat/menyempurnakan satu entri Codex. Bersifat in-memory (tidak dipersist
 * ke localStorage) — refresh halaman akan kembali ke panel sebelumnya.
 */
export interface WorkshopTarget {
  mode: 'create' | 'edit';
  /** Diisi pada mode 'edit' (Fase 2): id entri Codex yang sedang dibahas. */
  entryId?: number;
  /** Prefill nama saat membuka dari deteksi chat atau tombol cepat. */
  seedName?: string;
}

/**
 * Satu temuan dari pengecek konsistensi: sebuah bagian bab yang berpotensi
 * bertentangan dengan Story Bible / Codex / relasi, atau dengan logika internal
 * cerita. Hasil bersifat ephemeral (tidak dipersist) untuk v1.
 */
export interface ConsistencyFinding {
  /** Tingkat keparahan: high = kontradiksi nyata, low = kemungkinan/gaya. */
  severity: 'high' | 'medium' | 'low';
  /** Kategori temuan, mis. "Karakter", "Lore", "Timeline", "Plot", "Gaya". */
  type: string;
  /** Kutipan verbatim dari bab yang bermasalah. */
  quote: string;
  /** Apa yang dilanggar (entri Codex/aturan Bible/peristiwa sebelumnya). */
  conflictsWith: string;
  /** Penjelasan singkat mengapa ini inkonsisten. */
  explanation: string;
  /** Saran perbaikan. */
  suggestion: string;
}

export type SessionMode = 'prose-review' | 'plot-check' | 'brainstorm';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  id?: string;
  isActionable?: boolean;
  isWelcome?: boolean;
  isError?: boolean;
}

export interface ChatSession {
  id?: number;
  projectId: number;
  chapterId?: number;
  title: string;
  messages: ChatMessage[];
  lastMessageAt: number;
  mode?: SessionMode;
  smartAutoEnabled?: boolean;
  activeChapterId?: number;
  /** Membedakan sesi workspace Studio dari sesi Scribble inline & Lokakarya Codex. undefined = legacy (diperlakukan sebagai 'studio'). */
  kind?: 'studio' | 'scribble' | 'workshop';
  /**
   * Kunci sesi Lokakarya Codex (kind 'workshop') untuk resume per-target:
   * `entry:<id>` (edit entri) atau `new:<seed>` (buat baru). Non-indeks.
   */
  workshopKey?: string;
}

/**
 * Tingkat tensi/pacing per-bab yang DIDEKLARASIKAN penulis (Heatmap tensi, #16).
 * 1 = paling tenang, 5 = paling tegang. `Chapter.tension` undefined = "Otomatis"
 * (alat menurunkan saran dari sinyal prosa, tak disimpan).
 */
export type TensionLevel = 1 | 2 | 3 | 4 | 5;

export interface Chapter {
  id?: number;
  projectId: number;
  title: string;
  summary?: string;
  summaryUpdatedAt?: number;
  content: string;
  order: number;
  lastModified: number;
  status?: ChapterStatus;
  pov?: string;
  wordGoal?: number;
  /**
   * Tensi manual per-bab (#16), field INERT: bukan FK, tak diindeks, tak masuk KB
   * AI/ekspor. undefined = Otomatis (dipakai saran turunan `estimateTension`).
   * Menumpang objek chapter → backup/impor/deleteProject tak berubah.
   */
  tension?: TensionLevel;
}

export interface Project {
  id?: number;
  name: string;
  description: string;
  wordGoal?: number;
  dailyGoal?: number;
  createdAt: number;
  lastOpened: number;
  // Pelacakan target harian (field NON-INDEKS; ikut backup via tabel `projects`,
  // tanpa migrasi skema). Diisi/dibaca oleh useDailyProgress + src/lib/dailyProgress.ts.
  dailyLog?: Record<string, number>; // 'YYYY-MM-DD' (lokal) → kata ditulis hari itu
  lastWordCount?: number;            // total kata terakhir teramati (untuk hitung delta)
  lastWordCountDate?: string;        // tanggal observasi terakhir 'YYYY-MM-DD' (lokal)
}

// Kategori bawaan Codex. Kategori KUSTOM (buatan pengguna, tabel `codexCategories`)
// memakai slug bebas, sehingga nilai tersimpan di `CodexEntry.category` bertipe string.
// Union bawaan dipertahankan agar autocomplete tetap mengenali nilai standar.
export type BuiltinCodexCategory = 'character' | 'location' | 'item' | 'magic' | 'event' | 'other';
export type CodexCategory = BuiltinCodexCategory | (string & {});

// Bengkel Nama (#3) — palet fonotaktik per-faksi. Logika di `src/lib/nameForge.ts`.
export interface Morpheme {
  /** Potongan bunyi (huruf kecil), mis. "kel", "haven". */
  root: string;
  /** Makna akar, mis. "batu", "pelabuhan". */
  meaning: string;
}
export interface NamePalette {
  /** Pola suku kata: C=konsonan, V=nukleus. C sebelum V = onset, sesudah V = coda. */
  patterns: string[];
  onsets: string[];
  nuclei: string[];
  codas: string[];
  minSyllables?: number;
  maxSyllables?: number;
  morphemes?: Morpheme[];
}

// Kelengkapan worldbuilding (#11): status kematangan sebuah entri lore, dideklarasikan
// penulis. 'stub' = rangka/placeholder, 'partial' = ada isi tapi belum lengkap,
// 'solid' = matang. Logika turunan di `src/lib/worldCompleteness.ts`.
export type WorldStatus = 'stub' | 'partial' | 'solid';

export interface CodexEntry {
  id?: number;
  projectId: number;
  name: string;
  aliases: string[]; // for context matching
  category: CodexCategory;
  description: string;
  tags: string[];
  // Lapis "Kebenaran Tersembunyi" (kanon vs rahasia penulis):
  // - `hidden`: entri sepenuhnya rahasia (mystery-box). Disaring dari SEMUA permukaan
  //   pembaca (highlight editor, saran mention, ekspor Codex), tetapi TETAP diumpankan
  //   ke knowledge base AI agar Cek Konsistensi/Kontinuitas bisa menangkap kebocoran.
  // - `secret`: "kebenaran penulis" pada entri yang tetap publik (pola bible
  //   "Dunia percaya… / Yang sebenarnya…"). Masuk KB AI, tak pernah ke output pembaca.
  hidden?: boolean;
  secret?: string;
  /**
   * Bengkel Nama (#3): palet fonotaktik + leksikon morfem untuk entri faksi/ras.
   * JSON inert (BUKAN FK, tak diindeks, tak masuk KB AI/ekspor) — dipakai generator
   * & glos nama di `src/lib/nameForge.ts`. Ikut backup/impor otomatis sebagai bagian
   * objek codex.
   */
  namePalette?: NamePalette;
  /**
   * Pelacak kelengkapan worldbuilding (#11) — lapis manajemen-proyek untuk lore.
   * Keduanya inert (BUKAN FK, tak diindeks, TAK masuk KB AI/ekspor pembaca) — murni
   * metadata alur kerja penulis. Ikut backup/impor otomatis sebagai bagian objek codex.
   * - `worldStatus`: kematangan yang DIDEKLARASIKAN penulis (manual). undefined = belum
   *   ditetapkan → panel/form menampilkan SARAN otomatis (heuristik `suggestStatus`)
   *   tanpa menyimpannya (filosofi "penulis mendeklarasikan, alat membukukan").
   * - `todo`: catatan/gap bebas multi-baris (tiap baris = satu item TODO).
   * Logika di `src/lib/worldCompleteness.ts`.
   */
  worldStatus?: WorldStatus;
  todo?: string;
  /**
   * Template field per kategori (#17): nilai field terstruktur khas kategori (mis.
   * Bestiari: Habitat/Kelemahan). Array TER-DENORMALISASI & inert (BUKAN FK, tak
   * diindeks) — `label` di-snapshot dari `CategoryFieldDef` saat simpan agar SEMUA
   * jalur baca (KB AI, ekspor, detail) self-contained tanpa perlu resolusi kategori.
   * Skema field-nya sendiri hidup di `CustomCategory.fields`. Ikut backup/impor
   * otomatis sebagai bagian objek codex. Logika di `src/lib/codexFields.ts`.
   */
  customFields?: CustomFieldValue[];
}

// Template field per kategori (#17). Skema (definisi) hidup di CustomCategory.fields;
// nilainya di CodexEntry.customFields. Semua inert (bukan FK, tak diindeks).
export type CodexFieldType = 'text' | 'textarea' | 'number' | 'select';

export interface CategoryFieldDef {
  /** Slug STABIL (dari label saat dibuat) — jangan ubah; jadi kunci nilai di entri. */
  key: string;
  /** Label tampil; boleh disunting (entri lama menyimpan snapshot label sendiri). */
  label: string;
  type: CodexFieldType;
  /** Opsi untuk type 'select'. */
  options?: string[];
}

export interface CustomFieldValue {
  key: string;    // = CategoryFieldDef.key
  label: string;  // snapshot label saat simpan (self-contained untuk KB/ekspor)
  value: string;  // selalu string (number pun string) demi determinisme
}

// Kategori Codex kustom per-proyek. `slug` dipakai sebagai nilai `CodexEntry.category`
// dan tidak boleh berubah setelah dibuat (agar entri tetap tertaut). `icon`/`color`
// merujuk kunci di ICON_REGISTRY/COLOR_REGISTRY (src/lib/codexCategories.ts).
export interface CustomCategory {
  id?: number;
  projectId: number;
  slug: string;
  label: string;
  icon: string;
  color: string;
  order: number;
  /** Template field per kategori (#17) — skema field yang diisi entri kategori ini. */
  fields?: CategoryFieldDef[];
}

export interface StoryBibleRule {
  id?: number;
  projectId: number;
  key: string;
  instruction: string; // e.g. "Tone: Dark Fantasy", "POV: Third Person Limited"
  isVirtual?: boolean;
}

export type ContextDepth = 'minimal' | 'balanced' | 'deep';

export interface AISettings {
  model: string;
  temperature: number;
  contextDepth: ContextDepth;
}

export interface AIUsageLog {
  id?: number;
  timestamp: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Bagian promptTokens yang dilayani dari prompt cache provider (input murah). */
  cachedTokens?: number;
  provider: string;
  model: string;
  actionType: string;
}

export interface AppError {
  id?: number;
  message: string;
  stack?: string;
  timestamp: number;
  type: 'error' | 'warning' | 'info';
  source?: string;
  metadata?: any;
}

export interface BackupRecord {
  id?: number;
  timestamp: number;
  // String JSON (cadangan lama / saat kompresi tak didukung) ATAU gzip bytes bila
  // `compressed` true (BK3). Restore mendeteksi keduanya (typeof + magic bytes gzip).
  data: string | Uint8Array;
  size: number; // bytes (ukuran tersimpan)
  compressed?: boolean;
  // Jenis titik pulih: 'auto' (siklus/manual biasa) atau 'pre-restore' (snapshot
  // otomatis dari state saat ini tepat sebelum sebuah pemulihan menimpa data —
  // jaring undo). Absen pada cadangan lama → diperlakukan sebagai 'auto'.
  kind?: 'auto' | 'pre-restore';
}

export interface VectorEmbedding {
  id: string;
  projectId: number;
  codexId: number | string;
  contentHash: string;
  embedding: Float32Array;
  lastUpdated: number;
}

/**
 * Embedding semantik satu potongan (chunk) prosa naskah, untuk fitur
 * "Pencarian Semantik" (cari adegan berdasarkan makna, nol token).
 * id = `${projectId}_${chapterId}_${chunkIndex}`; contentHash = hash teks chunk
 * sehingga hanya bab/adegan yang berubah yang di-embed ulang (inkremental).
 */
export interface SceneEmbedding {
  id: string;
  projectId: number;
  chapterId: number;
  chunkIndex: number;
  contentHash: string;
  /** Cuplikan teks polos chunk (untuk ditampilkan di hasil, tanpa membuka bab). */
  snippet: string;
  embedding: Float32Array;
  lastUpdated: number;
}

export type PlotPromiseStatus = 'open' | 'paid' | 'abandoned';
export type PlotPromiseImportance = 'high' | 'medium' | 'low';

/**
 * "Janji Plot" (Chekhov's Gun) — elemen yang penulis nyatakan HARUS terbayar
 * (senjata, ramalan, misteri). Pelacakannya deterministik & nol token: alat hanya
 * membukukan di bab mana elemen muncul (via nama entri Codex atau kata kunci) lalu
 * menurunkan status "tertidur/aktif" — penulis yang memutuskan `status`. Lihat
 * `src/lib/plotPromises.ts`.
 *
 * FK (untuk importRemap & deleteProject): `projectId`, `codexId?` → codexIdMap,
 * `plantedChapterId?` → chapterIdMap, `payoffCodexId?` → codexIdMap.
 */
export interface PlotPromise {
  id?: number;
  projectId: number;
  title: string;
  description?: string;
  /** Tautan ke entri Codex → dilacak via PresenceIndex (nama + alias). */
  codexId?: number;
  /** Kata kunci untuk janji NON-entitas (ramalan/misteri) → pemindaian teks. */
  keywords?: string[];
  /** Bab tempat janji ditanam (opsional; kosong = kemunculan pertama yang terdeteksi). */
  plantedChapterId?: number;
  /**
   * Entri Codex yang DIBAYAR/diungkap janji ini (payoff/reveal), idealnya entri
   * `hidden` (rahasia penulis, lihat #1). Beda dari `codexId` (= apa janji ITU
   * sendiri): `payoffCodexId` = apa yang dibayarnya. Dipakai `analyzePayoffs` untuk
   * mengelompokkan "rahasia X disiapkan oleh kait A, B, C" & menandai yang kurang
   * ditanam. Tak dilacak di teks — murni tautan agregasi.
   */
  payoffCodexId?: number;
  /** Catatan bebas kapan seharusnya terbayar, mis. "sebelum klimaks". */
  expectedBy?: string;
  importance?: PlotPromiseImportance;
  /** Niat penulis (BUKAN turunan): open = masih ditunggu, paid = terbayar, abandoned = sengaja dibuang. */
  status: PlotPromiseStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * Glosarium istilah in-world (#8) — istilah NON-nama yang wajib konsisten ejaannya
 * (satuan, kalender, pangkat, lingua-franca, idiom). Generalisasi Buku Gaya: alih-alih
 * hanya nama Codex, glosarium menjaga istilah apa pun. Deterministik & nol token.
 *
 * FK (untuk importRemap & deleteProject): `projectId` saja (tak menautkan tabel lain).
 * Pencocokan di `src/lib/glossary.ts` (variant = ejaan salah yang dideklarasikan →
 * dibendera; typo = kandidat salah-eja mirip `term`).
 */
export interface GlossaryEntry {
  id?: number;
  projectId: number;
  /** Ejaan baku/disukai istilah. */
  term: string;
  definition?: string;
  /** Ejaan salah/varian yang dideklarasikan penulis → ditandai bila muncul. */
  variants?: string[];
  /** Kategori bebas (mis. "satuan", "pangkat", "kalender") — untuk pengelompokan UI. */
  category?: string;
  createdAt: number;
  updatedAt: number;
}
