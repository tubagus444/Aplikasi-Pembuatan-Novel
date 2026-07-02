/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '@/src/db';
import { BackupRecord } from '@/src/types';
import { selectBackupsToDelete } from '@/src/lib/backupRetention';

export interface BackupData {
  version: number;
  timestamp: number;
  // SHA-256 hex dari JSON `data` (#5). Ada sejak v4; cadangan lama tanpa field ini
  // dilewati verifikasinya (backward-compatible). Menangkap file terpotong/rusak
  // SEBELUM ditimpakan ke DB.
  checksum?: string;
  // Lingkup ekspor (#4). 'project' = ekspor SATU novel yang mandiri (untuk arsip /
  // memindahkan). Tak ada / 'all' = cadangan penuh semua proyek (perilaku lama,
  // backward-compatible). PENTING: file 'project' TIDAK boleh dipulihkan lewat jalur
  // restore-penuh (yang meng-clear semua tabel) — itu akan menghapus proyek lain;
  // impor per-proyek (remap id) adalah jalur terpisah yang menyusul.
  scope?: 'all' | 'project';
  // Nama proyek sumber saat scope='project' (untuk nama file & label impor nanti).
  projectName?: string;
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
    const data = {
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
    };
    return {
      version: 4, // v4: checksum SHA-256 integritas (v3: codexCategories)
      timestamp: Date.now(),
      checksum: await this.computeChecksum(JSON.stringify(data)),
      data
    };
  },

  /**
   * Ekspor SATU proyek sebagai cadangan mandiri (#4). Menyaring tiap tabel ke proyek
   * `projectId`. `snapshots` dikunci per `chapterId` (bukan `projectId`) → dikumpulkan
   * lewat daftar id bab proyek ini. `embeddings`/`sceneEmbeddings` sengaja TIDAK ikut:
   * di-regenerasi dari codex/naskah setelah impor (hindari embedding basi + hemat ukuran).
   * Bentuk envelope identik dgn `collectAllData` (checksum sama) plus `scope:'project'`
   * agar jalur restore-penuh bisa menolaknya (lihat catatan di BackupData.scope).
   */
  async collectProjectData(projectId: number): Promise<BackupData> {
    const project = await db.projects.get(projectId);
    if (!project) throw new Error('Proyek tidak ditemukan');

    const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
    const chapterIds = chapters.map(c => c.id!).filter((id): id is number => id != null);
    const snapshots = chapterIds.length
      ? await db.snapshots.where('chapterId').anyOf(chapterIds).toArray()
      : [];

    const data = {
      projects: [project],
      chapters,
      codex: await db.codex.where('projectId').equals(projectId).toArray(),
      bible: await db.bible.where('projectId').equals(projectId).toArray(),
      aiActions: await db.aiActions.where('projectId').equals(projectId).toArray(),
      snapshots,
      timeline: await db.timeline.where('projectId').equals(projectId).toArray(),
      relationships: await db.relationships.where('projectId').equals(projectId).toArray(),
      chatSessions: await db.chatSessions.where('projectId').equals(projectId).toArray(),
      codexCategories: await db.codexCategories.where('projectId').equals(projectId).toArray()
    };
    return {
      version: 4,
      timestamp: Date.now(),
      scope: 'project',
      projectName: project.name,
      checksum: await this.computeChecksum(JSON.stringify(data)),
      data
    };
  },

  /**
   * SHA-256 hex dari string (dipakai untuk checksum integritas cadangan, #5).
   * Best-effort: bila `crypto.subtle` tak tersedia (konteks tak-aman/browser lawas),
   * kembalikan undefined → cadangan dibuat tanpa checksum, restore melewati verifikasi.
   */
  async computeChecksum(dataString: string): Promise<string | undefined> {
    try {
      if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
      const bytes = new TextEncoder().encode(dataString);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return undefined;
    }
  },

  /**
   * Saves backup data to the internal IndexedDB 'backups' table.
   * Keeps only the latest 5 backups. Dikompresi gzip bila didukung (BK3) — 5×
   * JSON penuh bisa membengkak; gzip memangkasnya signifikan. Bila kompresi tak
   * didukung/gagal, simpan JSON string mentah (tetap dapat dipulihkan).
   */
  async saveToInternalDB(data: BackupData, kind: 'auto' | 'pre-restore' = 'auto'): Promise<void> {
    const jsonString = JSON.stringify(data);
    const { blob, compressed } = await this.compressData(jsonString);

    let stored: string | Uint8Array;
    let size: number;
    if (compressed) {
      stored = new Uint8Array(await blob.arrayBuffer());
      size = stored.byteLength;
    } else {
      stored = jsonString;
      size = new Blob([jsonString]).size;
    }

    await db.backups.add({
      timestamp: data.timestamp,
      data: stored,
      size,
      compressed,
      kind
    });

    // Rotasi berjenjang (#3): simpan perwakilan terbaru + harian + mingguan alih-alih
    // sekadar 5 terbaru, agar titik pulih lama selamat dari korupsi yang lambat disadari.
    const allBackups = await db.backups.orderBy('timestamp').toArray();
    const toDelete = selectBackupsToDelete(allBackups, b => b.timestamp);
    if (toDelete.length) {
      await db.backups.bulkDelete(toDelete.map(b => b.id!));
    }
  },

  /**
   * Mengubah `BackupRecord.data` (string JSON lama, gzip bytes, atau bytes mentah
   * bila kompresi sempat gagal) kembali menjadi string JSON. Deteksi gzip via magic
   * bytes (0x1f 0x8b) agar robust tanpa bergantung penuh pada flag `compressed`.
   */
  async decodeInternalBackup(backup: BackupRecord): Promise<string> {
    const d = backup.data;
    if (typeof d === 'string') return d; // cadangan lama: JSON mentah
    const bytes = d instanceof Uint8Array ? d : new Uint8Array(d as ArrayBuffer);
    const isGzip = bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (isGzip && typeof DecompressionStream !== 'undefined') {
      // @ts-ignore
      const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(ds).text();
    }
    // Bukan gzip (kompresi sempat fallback) → bytes adalah UTF-8 JSON mentah.
    return new TextDecoder().decode(bytes);
  },

  /**
   * Helper internal & sumber tunggal kompresi (dipakai juga driveBackupService).
   * Mengembalikan `{ blob, compressed }` agar pemanggil bisa menamai file dengan
   * benar: bila kompresi gagal/tak didukung, `compressed:false` → file JANGAN
   * diberi ekstensi `.gz` (lihat BK4) supaya restore tak salah memanggil
   * DecompressionStream pada data mentah.
   */
  async compressData(dataString: string): Promise<{ blob: Blob; compressed: boolean }> {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);
    const blob = new Blob([data]);

    if (typeof CompressionStream === 'undefined') {
      console.warn("CompressionStream not supported in this browser. Backup will be uncompressed.");
      return { blob, compressed: false };
    }

    try {
      const stream = blob.stream();
      // @ts-ignore
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      return { blob: await new Response(compressedStream).blob(), compressed: true };
    } catch (err) {
      console.error("Compression failed:", err);
      return { blob, compressed: false };
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
    // Write compressed data (ekstensi mengikuti hasil kompresi: .json.gz hanya bila
    // benar-benar ter-gzip; bila tidak → .json mentah agar bisa dipulihkan — BK4)
    const jsonString = JSON.stringify(data);
    const { blob, compressed } = await this.compressData(jsonString);

    const ext = compressed ? '.json.gz' : '.json';
    const filename = `aetherscribe-autobackup-${new Date().toISOString().replace(/[:.]/g, '-')}${ext}`;
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // Rotasi berjenjang (#3): kumpulkan file cadangan + timestamp aktual (lastModified,
    // lebih andal daripada parsing ISO di nama file) lalu terapkan kebijakan retensi.
    const externalBackups: { name: string; timestamp: number }[] = [];
    // @ts-ignore - File System Access API Async Iterable
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('aetherscribe-autobackup-')) {
            let ts = 0; // fallback: dianggap tertua → boleh dihapus lebih dulu
            try {
                const f = await (entry as FileSystemFileHandle).getFile();
                ts = f.lastModified;
            } catch { /* abaikan; pakai fallback 0 */ }
            externalBackups.push({ name: entry.name, timestamp: ts });
        }
    }

    const toDelete = selectBackupsToDelete(externalBackups, b => b.timestamp);
    for (const file of toDelete) {
        await dirHandle.removeEntry(file.name);
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

    // Verifikasi integritas (#5): bila cadangan menyertakan checksum, cocokkan sebelum
    // menyentuh DB. Menangkap file terpotong/rusak lebih dini — TIDAK menimpa & tidak
    // membuang jaring undo. Cadangan lama tanpa checksum dilewati (backward-compatible);
    // bila crypto tak tersedia (`actual` undefined) verifikasi juga dilewati, bukan gagal.
    if (parsedData.checksum) {
      const actual = await this.computeChecksum(JSON.stringify(data));
      if (actual && actual !== parsedData.checksum) {
        throw new Error('Verifikasi integritas gagal: cadangan tampak rusak atau tidak lengkap.');
      }
    }

    // Jaring undo (#2): potret state saat ini ke tabel `backups` (tak ikut di-clear
    // oleh transaksi restore) SEBELUM menimpa. Melindungi SEMUA jalur restore
    // (internal / file JSON / Drive) dari cadangan yang valid-sintaks tapi lossy.
    // Best-effort: kegagalan (mis. kuota) tak boleh membatalkan restore yang
    // diminta pengguna — cukup diperingatkan di konsol.
    try {
      const current = await this.collectAllData();
      await this.saveToInternalDB(current, 'pre-restore');
    } catch (err) {
      console.warn('Gagal membuat snapshot pra-pemulihan; melanjutkan restore tanpa jaring undo.', err);
    }

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

    const json = await this.decodeInternalBackup(backup);
    const parsedData: BackupData = JSON.parse(json);
    await this.restoreData(parsedData);
  },

  /**
   * Returns list of internal backups, sorted by newest.
   */
  async getBackupList(): Promise<BackupRecord[]> {
    return db.backups.orderBy('timestamp').reverse().toArray();
  }
};
