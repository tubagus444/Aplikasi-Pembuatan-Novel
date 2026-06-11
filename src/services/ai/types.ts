import { StoryBibleRule, CodexEntry, SessionMode } from '@/src/types';

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface AIRenderParams {
  systemInstruction: string;
  userPrompt: string;
  actionType?: 'chat' | 'summarize' | 'rewrite' | 'extract' | 'expand' | 'other';
  provider?: string;
  model?: string;
  history?: { role: 'user' | 'model', parts: { text: string }[] }[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  stream?: boolean;
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
