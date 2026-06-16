/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '@/src/db';
import { BackupRecord } from '@/src/types';

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
    chatSessions: any[];
    codexCategories?: any[];
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
      version: 3, // v3: menyertakan codexCategories (kategori Codex kustom)
      timestamp: Date.now(),
      data: {
        projects: await db.projects.toArray(),
        chapters: await db.chapters.toArray(),
        codex: await db.codex.toArray(),
        bible: await db.bible.toArray(),
        aiActions: await db.aiActions.toArray(),
        snapshots: await db.snapshots.toArray(),
        timeline: await db.timeline.toArray(),
        relationships: await db.relationships.toArray(),
        chatSessions: await db.chatSessions.toArray(),
        codexCategories: await db.codexCategories.toArray()
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
   * Helper internal: Compress string data to gzip Blob
   */
  async compressData(dataString: string): Promise<Blob> {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);
    const blob = new Blob([data]);
    
    if (typeof CompressionStream === 'undefined') {
      console.warn("CompressionStream not supported in this browser. Backup will be uncompressed.");
      return blob;
    }

    try {
      const stream = blob.stream();
      // @ts-ignore
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      return await new Response(compressedStream).blob();
    } catch (err) {
      console.error("Compression failed:", err);
      return blob;
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
   * Creates a new backup file in the specified directory with compression and versioning.
   */
  async saveToDirectory(data: BackupData, dirHandle: FileSystemDirectoryHandle): Promise<void> {
    const filename = `aetherscribe-autobackup-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    
    // Write compressed data
    const jsonString = JSON.stringify(data);
    const compressedBlob = await this.compressData(jsonString);
    const writable = await fileHandle.createWritable();
    await writable.write(compressedBlob);
    await writable.close();

    // Rotate backups in this directory: keep only the 5 most recent backups
    const externalBackups = [];
    // @ts-ignore - File System Access API Async Iterable
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('aetherscribe-autobackup-')) {
            externalBackups.push(entry);
        }
    }

    if (externalBackups.length > 5) {
        // Sort ascending by timestamp (due to ISO format in filename)
        externalBackups.sort((a, b) => a.name.localeCompare(b.name));
        const toDelete = externalBackups.slice(0, externalBackups.length - 5);
        for (const file of toDelete) {
            await dirHandle.removeEntry(file.name);
        }
    }
  },

  /**
   * Sumber kebenaran tunggal untuk SEMUA jalur restore (internal DB & file).
   * Semua tabel di-clear lalu diisi ulang dalam satu transaksi (atomik: rollback
   * bila gagal). `embeddings` sengaja di-clear—bukan dipulihkan—agar di-regenerasi
   * ulang dari codex (mencegah embedding basi/tak sinkron setelah restore).
   * Backward-compatible: backup lama tanpa `chatSessions` tetap aman (guard `?.length`).
   */
  async restoreData(parsedData: BackupData): Promise<void> {
    const data = parsedData?.data;
    if (!data || !data.projects) throw new Error('Format cadangan tidak valid');

    await db.transaction('rw',
      [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships, db.chatSessions, db.embeddings, db.codexCategories],
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
        await db.chatSessions.clear();
        await db.codexCategories.clear();
        await db.embeddings.clear(); // di-regenerasi dari codex; jangan dipulihkan dari backup

        // Restore from backup
        if (data.projects?.length) await db.projects.bulkAdd(data.projects);
        if (data.chapters?.length) await db.chapters.bulkAdd(data.chapters);
        if (data.codex?.length) await db.codex.bulkAdd(data.codex);

        // Deduplicate bible entries before bulk adding (respect unique index [projectId+key])
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
        if (data.chatSessions?.length) await db.chatSessions.bulkAdd(data.chatSessions);
        if (data.codexCategories?.length) await db.codexCategories.bulkAdd(data.codexCategories);
    });
  },

  /**
   * Restores data from an internal backup record.
   */
  async restoreFromBackup(backupId: number): Promise<void> {
    const backup = await db.backups.get(backupId);
    if (!backup) throw new Error('Backup not found');

    const parsedData: BackupData = JSON.parse(backup.data);
    await this.restoreData(parsedData);
  },

  /**
   * Returns list of internal backups, sorted by newest.
   */
  async getBackupList(): Promise<BackupRecord[]> {
    return db.backups.orderBy('timestamp').reverse().toArray();
  }
};
