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
}

export interface StoryBeat {
  id?: number;
  chapterId: number;
  projectId: number;
  title: string;
  description: string;
  type: 'action' | 'dialogue' | 'twist' | 'climax' | 'setup';
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

export type ViewMode = 'write' | 'outline' | 'codex' | 'bible' | 'settings' | 'actions' | 'relationships' | 'guide' | 'errors' | 'brainstorm';

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
  title: string;
  messages: ChatMessage[];
  lastMessageAt: number;
}

export interface Chapter {
  id?: number;
  projectId: number;
  title: string;
  summary?: string;
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
}

export type CodexCategory = 'character' | 'location' | 'item' | 'magic' | 'event' | 'other';

export interface CodexEntry {
  id?: number;
  projectId: number;
  name: string;
  aliases: string[]; // for context matching
  category: CodexCategory;
  description: string;
  tags: string[];
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
  data: string; // JSON
  size: number; // bytes
}
