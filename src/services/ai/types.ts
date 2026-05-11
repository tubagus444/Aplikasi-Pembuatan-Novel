import { StoryBibleRule, CodexEntry } from "../../types";

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface AIRenderParams {
  systemInstruction: string;
  userPrompt: string;
  model?: string;
  history?: { role: 'user' | 'model', parts: { text: string }[] }[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface GenerateParams {
  prompt: string;
  selection: string;
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  action: string;
}

export interface ChatParams {
  message: string;
  history: { role: 'user' | 'model', parts: { text: string }[] }[];
  bibleRules: StoryBibleRule[];
  codexEntries: CodexEntry[];
  contextText: string;
}
