/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { Table } from 'dexie';
import { Chapter, Project, CodexEntry, StoryBibleRule, AIAction, Snapshot, StoryBeat, Relationship, AppError, BackupRecord, ChatSession, VectorEmbedding, AIUsageLog } from '@/src/types';

export class AetherScribeDB extends Dexie {
  projects!: Table<Project>;
  chapters!: Table<Chapter>;
  codex!: Table<CodexEntry>;
  bible!: Table<StoryBibleRule>;
  aiActions!: Table<AIAction>;
  snapshots!: Table<Snapshot>;
  timeline!: Table<StoryBeat>;
  relationships!: Table<Relationship>;
  errors!: Table<AppError>;
  backups!: Table<BackupRecord>;
  chatSessions!: Table<ChatSession>;
  embeddings!: Table<VectorEmbedding>;
  aiUsageLogs!: Table<AIUsageLog>;

  constructor() {
    super('AetherScribeDB');
    this.version(10).stores({
      bible: '++id, projectId, key'
    }).upgrade(async (tx) => {
      // Cleanup duplicate bible entries before applying unique index in next version
      const bibleEntries = await tx.table('bible').toArray();
      const seen = new Set<string>();
      const idsToDelete: any[] = [];

      for (const entry of bibleEntries) {
        const compositeKey = `${entry.projectId}|${entry.key}`;
        if (seen.has(compositeKey)) {
          idsToDelete.push(entry.id);
        } else {
          seen.add(compositeKey);
        }
      }

      if (idsToDelete.length > 0) {
        await tx.table('bible').bulkDelete(idsToDelete);
        console.log(`Cleaned up ${idsToDelete.length} duplicate bible entries during migration.`);
      }
    });

    this.version(11).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key, &[projectId+key]',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId',
      errors: '++id, timestamp, type',
      chatSessions: '++id, projectId, lastMessageAt'
    });

    this.version(12).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key, &[projectId+key]',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId',
      errors: '++id, timestamp, type',
      chatSessions: '++id, projectId, lastMessageAt',
      backups: '++id, timestamp'
    });

    this.version(13).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key, &[projectId+key]',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId',
      errors: '++id, timestamp, type',
      backups: '++id, timestamp',
      chatSessions: '++id, projectId, chapterId, lastMessageAt'
    });

    this.version(14).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key, &[projectId+key]',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId',
      errors: '++id, timestamp, type',
      backups: '++id, timestamp',
      chatSessions: '++id, projectId, chapterId, activeChapterId, lastMessageAt'
    });

    this.version(15).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key, &[projectId+key]',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId',
      errors: '++id, timestamp, type',
      backups: '++id, timestamp',
      chatSessions: '++id, projectId, chapterId, activeChapterId, lastMessageAt'
    });

    this.version(16).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key, &[projectId+key]',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId',
      errors: '++id, timestamp, type',
      backups: '++id, timestamp',
      chatSessions: '++id, projectId, chapterId, activeChapterId, lastMessageAt',
      embeddings: 'id, projectId, codexId'
    });

    this.version(17).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key, &[projectId+key]',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId',
      errors: '++id, timestamp, type',
      backups: '++id, timestamp',
      chatSessions: '++id, projectId, chapterId, activeChapterId, lastMessageAt',
      embeddings: 'id, projectId, codexId',
      aiUsageLogs: '++id, timestamp, provider, actionType'
    });
  }
}

export const db = new AetherScribeDB();

// Helper to initialize a default project if none exists
export async function ensureDefaultProject() {
  const count = await db.projects.count();
  if (count === 0) {
    const projectId = await db.projects.add({
      name: 'Untitled Novel',
      description: 'Start your masterpiece here.',
      createdAt: Date.now(),
      lastOpened: Date.now(),
    });
    
    await db.chapters.add({
      projectId,
      title: 'Chapter 1',
      content: 'Once upon a time...',
      order: 0,
      lastModified: Date.now(),
    });

    await db.bible.add({
      projectId,
      key: 'Tone',
      instruction: 'Dark and atmospheric'
    });
    
    return projectId;
  }
  const latest = await db.projects.orderBy('lastOpened').reverse().first();
  return latest?.id;
}

export async function cleanupAILogs() {
  try {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const deleteCount = await db.aiUsageLogs.where('timestamp').below(thirtyDaysAgo).delete();
    if (deleteCount > 0) {
      console.log(`Cleaned up ${deleteCount} old AI usage logs.`);
    }
  } catch (err) {
    console.error('Failed to cleanup AI usage logs:', err);
  }
}

