/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db';
import { BackupRecord } from '../types';

export interface BackupData {
  version: number;
  timestamp: number;
  data: {
    projects: any[];
    chapters: any[];
    codex: any[];
    bible: any[];
    aiActions: any[];
    snapshots: any[];
    timeline: any[];
    relationships: any[];
  };
}

export const backupService = {
  /**
   * Collects all data from the database.
   * Note: projectId is optional; if provided, technically we could filter,
   * but manual backup collects everything to ensure full redundancy.
   */
  async collectAllData(): Promise<BackupData> {
    return {
      version: 1,
      timestamp: Date.now(),
      data: {
        projects: await db.projects.toArray(),
        chapters: await db.chapters.toArray(),
        codex: await db.codex.toArray(),
        bible: await db.bible.toArray(),
        aiActions: await db.aiActions.toArray(),
        snapshots: await db.snapshots.toArray(),
        timeline: await db.timeline.toArray(),
        relationships: await db.relationships.toArray()
      }
    };
  },

  /**
   * Saves backup data to the internal IndexedDB 'backups' table.
   * Keeps only the latest 5 backups.
   */
  async saveToInternalDB(data: BackupData): Promise<void> {
    const jsonString = JSON.stringify(data);
    const size = new Blob([jsonString]).size;

    await db.backups.add({
      timestamp: data.timestamp,
      data: jsonString,
      size: size
    });

    // Roll rotation: keep only latest 5
    const allBackups = await db.backups.orderBy('timestamp').toArray();
    if (allBackups.length > 5) {
      const toDelete = allBackups.slice(0, allBackups.length - 5);
      await db.backups.bulkDelete(toDelete.map(b => b.id!));
    }
  },

  /**
   * Writes the backup JSON to a file via File System Access API.
   */
  async saveToFile(data: BackupData, fileHandle: FileSystemFileHandle): Promise<void> {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  },

  /**
   * Creates a new backup file in the specified directory.
   */
  async saveToDirectory(data: BackupData, dirHandle: FileSystemDirectoryHandle): Promise<void> {
    const filename = `aetherscribe-autobackup-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    await this.saveToFile(data, fileHandle);
  },

  /**
   * Restores data from an internal backup record.
   */
  async restoreFromBackup(backupId: number): Promise<void> {
    const backup = await db.backups.get(backupId);
    if (!backup) throw new Error('Backup not found');

    const parsedData: BackupData = JSON.parse(backup.data);
    
    await db.transaction('rw', 
      [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships], 
      async () => {
        // Clear existing data
        await db.projects.clear();
        await db.chapters.clear();
        await db.codex.clear();
        await db.bible.clear();
        await db.aiActions.clear();
        await db.snapshots.clear();
        await db.timeline.clear();
        await db.relationships.clear();

        const { data } = parsedData;

        // Restore from backup
        if (data.projects?.length) await db.projects.bulkAdd(data.projects);
        if (data.chapters?.length) await db.chapters.bulkAdd(data.chapters);
        if (data.codex?.length) await db.codex.bulkAdd(data.codex);
        
        // Deduplicate bible entries before bulk adding
        if (data.bible?.length) {
          const seen = new Set<string>();
          const uniqueBible = data.bible.filter((entry: any) => {
            const compositeKey = `${entry.projectId}|${entry.key}`;
            if (seen.has(compositeKey)) return false;
            seen.add(compositeKey);
            return true;
          });
          await db.bible.bulkAdd(uniqueBible);
        }

        if (data.aiActions?.length) await db.aiActions.bulkAdd(data.aiActions);
        if (data.snapshots?.length) await db.snapshots.bulkAdd(data.snapshots);
        if (data.timeline?.length) await db.timeline.bulkAdd(data.timeline);
        if (data.relationships?.length) await db.relationships.bulkAdd(data.relationships);
    });
  },

  /**
   * Returns list of internal backups, sorted by newest.
   */
  async getBackupList(): Promise<BackupRecord[]> {
    return db.backups.orderBy('timestamp').reverse().toArray();
  }
};
