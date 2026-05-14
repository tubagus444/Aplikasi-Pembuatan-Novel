import { StoryBibleRule, CodexEntry } from "../../types";

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface AIRenderParams {
  systemInstruction: string;
  userPrompt: string;
  provider?: string;
  model?: string;
  history?: { role: 'user' | 'model', parts: { text: string }[] }[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateParams {
  prompt: string;
  selection: string;
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  action: string;
  chapterId?: number;
  provider?: string;
}

export interface ChatParams {
  message: string;
  history: { role: 'user' | 'model', parts: { text: string }[] }[];
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  contextText: string;
  chapterId?: number; // Added/verified for chapter-specific AI context
  provider?: string;
}
