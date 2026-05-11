/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { Table } from 'dexie';
import { Chapter, Project, CodexEntry, StoryBibleRule, AIAction, Snapshot, StoryBeat, Relationship } from './types';

export class AetherScribeDB extends Dexie {
  projects!: Table<Project>;
  chapters!: Table<Chapter>;
  codex!: Table<CodexEntry>;
  bible!: Table<StoryBibleRule>;
  aiActions!: Table<AIAction>;
  snapshots!: Table<Snapshot>;
  timeline!: Table<StoryBeat>;
  relationships!: Table<Relationship>;

  constructor() {
    super('AetherScribeDB');
    this.version(6).stores({
      projects: '++id, name, lastOpened',
      chapters: '++id, projectId, order',
      codex: '++id, projectId, name, category, *aliases',
      bible: '++id, projectId, key',
      aiActions: '++id, projectId, label',
      snapshots: '++id, chapterId, timestamp',
      timeline: '++id, chapterId, projectId, type',
      relationships: '++id, projectId, sourceId, targetId'
    }).upgrade(() => {
      // Future migrations go here
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
