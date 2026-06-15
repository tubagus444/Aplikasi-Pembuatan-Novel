import { StoryBibleRule, CodexEntry, SessionMode } from '@/src/types';

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface AIRenderParams {
  systemInstruction: string;
  userPrompt: string;
  actionType?: 'chat' | 'summarize' | 'rewrite' | 'extract' | 'expand' | 'consistency' | 'other';
  provider?: string;
  model?: string;
  history?: { role: 'user' | 'model', parts: { text: string }[] }[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  stream?: boolean;
  /**
   * Saat true, knowledge base (Story Bible + Codex) di system prompt ditandai
   * sebagai blok cache (cache_control ephemeral) agar provider menyimpannya di
   * prompt cache. Hanya diset pada "caching mode" untuk provider yang mendukung.
   */
  cacheable?: boolean;
  onChunk?: (chunk: string) => void;
  onRetry?: (attempt: number, error: any, provider: string) => void;
}

export interface GenerateParams {
  prompt: string;
  selection: string;
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  relationships?: import('@/src/types').Relationship[];
  action: string;
  chapterId?: number;
  provider?: string;
  contextText?: string;
  ragContextText?: string;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
  onRetry?: (attempt: number, error: any, provider: string) => void;
}

export interface ConsistencyParams {
  /** Teks bab (plain text, sudah di-strip HTML) yang akan diperiksa. */
  chapterText: string;
  chapterTitle?: string;
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  relationships?: import('@/src/types').Relationship[];
  /**
   * Ringkasan kronologi timeline (sudah diformat) untuk membantu AI menangkap
   * pelanggaran urutan waktu. Dibangun di pemanggil (punya akses bab & codex).
   */
  timelineSummary?: string;
  provider?: string;
  onRetry?: (attempt: number, error: any, provider: string) => void;
}

export interface ChatParams {
  message: string;
  history: { role: 'user' | 'model', parts: { text: string }[] }[];
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  relationships?: import('@/src/types').Relationship[];
  contextText: string;
  chapterId?: number; // Added/verified for chapter-specific AI context
  provider?: string;
  sessionMode?: SessionMode;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
  onRetry?: (attempt: number, error: any, provider: string) => void;
}
