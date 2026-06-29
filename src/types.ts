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

export type ViewMode = 'write' | 'outline' | 'codex' | 'bible' | 'settings' | 'actions' | 'relationships' | 'guide' | 'errors' | 'brainstorm' | 'dashboard' | 'consistency' | 'timeline' | 'orphans' | 'continuity' | 'arc';

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
  /** Membedakan sesi workspace Studio dari sesi Scribble inline. undefined = legacy (diperlakukan sebagai 'studio'). */
  kind?: 'studio' | 'scribble';
}

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

export interface CodexEntry {
  id?: number;
  projectId: number;
  name: string;
  aliases: string[]; // for context matching
  category: CodexCategory;
  description: string;
  tags: string[];
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
}

export interface VectorEmbedding {
  id: string;
  projectId: number;
  codexId: number | string;
  contentHash: string;
  embedding: Float32Array;
  lastUpdated: number;
}
