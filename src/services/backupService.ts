/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '@/src/db';
import { BackupRecord } from '@/src/types';
import { selectBackupsToDelete, selectBackupToEvict } from '@/src/lib/backupRetention';
import { assembleBackupJson } from '@/src/lib/backupEnvelope';
import { blobToDataUrl, dataUrlToBlob } from '@/src/lib/blobCodec';
import {
  remapProjectDependents,
  summarizeProjectBackup,
  validateProjectBackup,
  importedProjectName,
  type ProjectBackupData,
  type ProjectBackupCounts,
} from '@/src/lib/importRemap';

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
    plotPromises?: any[];
    glossary?: any[];
    // Atlas Dunia (v7). `maps[].imageBlob` diganti `imageDataUrl` (base64) karena Blob
    // tak selamat lewat JSON. Sengaja DIKELUARKAN dari rolling auto-backup internal
    // (saveToInternalDB) demi menekan bengkak 5× — lengkap hanya di file/Drive/ekspor.
    maps?: any[];
    mapMarkers?: any[];
  };
}

/**
 * Deteksi kegagalan kuota penyimpanan (IndexedDB penuh). Nama/kode berbeda antar
 * browser (Chrome: `QuotaExceededError`/code 22; Firefox: `NS_ERROR_DOM_QUOTA_REACHED`/
 * code 1014) → cek beberapa varian + pesan.
 */
function isQuotaError(err: any): boolean {
  if (!err) return false;
  const name = err.name || err.inner?.name; // Dexie membungkus DOMException di `inner`
  const code = err.code ?? err.inner?.code;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014 ||
    /quota/i.test(String(err?.message || ''))
  );
}

export const backupService = {
  /** Ganti `imageBlob` (Blob) → `imageDataUrl` (base64) agar aman di JSON. */
  async serializeMaps(maps: any[]): Promise<any[]> {
    return Promise.all(maps.map(async (m) => {
      const { imageBlob, ...rest } = m;
      return { ...rest, imageDataUrl: imageBlob instanceof Blob ? await blobToDataUrl(imageBlob) : undefined };
    }));
  },

  /** Kebalikan `serializeMaps`: `imageDataUrl` → `imageBlob` (Blob). Async → panggil
   *  di LUAR transaksi Dexie (fetch data URL tak boleh menggantung transaksi). */
  async deserializeMaps(maps: any[] | undefined): Promise<any[]> {
    return Promise.all((maps ?? []).map(async (m) => {
      const { imageDataUrl, ...rest } = m;
      return { ...rest, imageBlob: imageDataUrl ? await dataUrlToBlob(imageDataUrl) : undefined };
    }));
  },
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
      codexCategories: await db.codexCategories.toArray(),
      plotPromises: await db.plotPromises.toArray(),
      glossary: await db.glossary.toArray(),
      maps: await this.serializeMaps(await db.maps.toArray()),
      mapMarkers: await db.mapMarkers.toArray()
    };
    return {
      version: 7, // v7: maps/mapMarkers (v6: glossary; v5: plotPromises; v4: checksum; v3: codexCategories)
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
      codexCategories: await db.codexCategories.where('projectId').equals(projectId).toArray(),
      plotPromises: await db.plotPromises.where('projectId').equals(projectId).toArray(),
      glossary: await db.glossary.where('projectId').equals(projectId).toArray(),
      // Ekspor per-novel = jalur LENGKAP: gambar peta ikut (base64) agar restore utuh.
      maps: await this.serializeMaps(await db.maps.where('projectId').equals(projectId).toArray()),
      mapMarkers: await db.mapMarkers.where('projectId').equals(projectId).toArray()
    };
    return {
      version: 7,
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
    // Rolling auto-backup menyimpan hingga ~5 salinan → BUANG gambar peta (base64)
    // agar tak membengkak berlipat di IndexedDB. Penanda tetap ikut; gambar dipulihkan
    // dari file/Drive/ekspor per-novel.
    let leanData = data.data;
    if (data.data?.maps?.length) {
      const leanMaps = data.data.maps.map((m: any) => { const { imageDataUrl, ...rest } = m; return rest; });
      leanData = { ...data.data, maps: leanMaps };
    }

    // Serialisasi data BESAR sekali saja (dulu 2×: checksum + payload → puncak memori &
    // jank main thread tiap siklus). Checksum DIHITUNG ULANG atas data ramping ini (kalau
    // tidak, verifikasi restore gagal vs checksum data penuh), lalu envelope dirakit dengan
    // menyisipkan `dataString` tanpa men-stringify ulang data besar.
    const dataString = JSON.stringify(leanData);
    const checksum = await this.computeChecksum(dataString);
    const meta: Record<string, unknown> = { version: data.version, timestamp: data.timestamp };
    if (data.scope) meta.scope = data.scope;
    if (data.projectName) meta.projectName = data.projectName;
    if (checksum) meta.checksum = checksum;
    const jsonString = assembleBackupJson(meta, dataString);
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

    await this.addBackupResilient({
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
   * Tambah satu cadangan dengan DEGRADASI saat kuota penuh. Dulu `db.backups.add`
   * dipanggil SEBELUM rotasi → `add` gagal justru saat penyimpanan hampir penuh (tak
   * ada ruang dibebaskan lebih dulu) & tanpa pemulihan. Kini: bila `add` melempar error
   * kuota, buang cadangan 'auto' TERTUA (JANGAN sentuh 'pre-restore' = jaring undo) lalu
   * coba lagi, berulang sampai berhasil atau tak ada lagi yang bisa dibuang.
   */
  async addBackupResilient(record: Omit<BackupRecord, 'id'>): Promise<void> {
    try {
      await db.backups.add(record as BackupRecord);
      return;
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      console.warn('[Backup] Penyimpanan penuh saat menyimpan cadangan; membuang cadangan lama lalu mencoba lagi…');
    }

    // Evakuasi bertahap + retry.
    for (;;) {
      const evicted = await this.evictOldestAutoBackup();
      if (!evicted) {
        // Hanya tersisa 'pre-restore' (tak boleh dibuang) → menyerah dengan aman.
        throw new Error(
          'Penyimpanan penuh: cadangan otomatis tak dapat disimpan. Hapus data lama atau ekspor manuskrip ke file.'
        );
      }
      try {
        await db.backups.add(record as BackupRecord);
        return;
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        // Masih penuh → lanjut membuang cadangan berikutnya.
      }
    }
  },

  /**
   * Hapus cadangan 'auto' TERTUA untuk membebaskan ruang. Mengembalikan `false` bila
   * tak ada lagi yang aman dibuang. Dipertahankan: SEMUA 'pre-restore' (jaring undo) &
   * SATU cadangan 'auto' terbaru — agar lonjakan kuota tak menghapus seluruh riwayat
   * hanya demi memuat satu cadangan baru (yang bahkan mungkin tetap tak muat).
   */
  async evictOldestAutoBackup(): Promise<boolean> {
    const all = await db.backups.orderBy('timestamp').toArray();
    const victim = selectBackupToEvict(all, b => b.timestamp, b => b.kind === 'pre-restore');
    if (!victim?.id) return false;
    await db.backups.delete(victim.id);
    return true;
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
   * bila gagal). `embeddings` & `sceneEmbeddings` sengaja di-clear—bukan dipulihkan—agar
   * di-regenerasi ulang dari codex/naskah (mencegah indeks basi/tak sinkron setelah restore).
   * Backward-compatible: backup lama tanpa `chatSessions` tetap aman (guard `?.length`).
   */
  async restoreData(parsedData: BackupData): Promise<void> {
    if (!parsedData || typeof parsedData.version !== 'number') {
      throw new Error('Format cadangan tidak valid atau versi terlalu usang (tidak dikenali).');
    }
    // Tolak backup yang terlalu tua (mis. sebelum v3) karena skema Dexie mungkin
    // sangat tidak kompatibel dan memicu error runtime (tabel wajib hilang).
    if (parsedData.version < 3) {
      throw new Error(`Cadangan versi ${parsedData.version} terlalu usang dan tidak kompatibel dengan aplikasi versi saat ini.`);
    }

    const data = parsedData.data;
    if (!data || !Array.isArray(data.projects) || !Array.isArray(data.chapters) || !Array.isArray(data.codex)) {
      throw new Error('Format cadangan tidak valid: tabel inti (proyek/bab/codex) tidak ditemukan atau korup.');
    }

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

    // Dekode gambar peta (data URL → Blob) di LUAR transaksi (fetch async tak boleh
    // menggantung transaksi Dexie). Backup ramping (rolling internal) → imageBlob undefined.
    const mapRows = await this.deserializeMaps(data.maps);

    await db.transaction('rw',
      [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships, db.chatSessions, db.embeddings, db.sceneEmbeddings, db.codexCategories, db.plotPromises, db.glossary, db.maps, db.mapMarkers],
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
        await db.plotPromises.clear();
        await db.glossary.clear();
        await db.maps.clear();
        await db.mapMarkers.clear();
        await db.embeddings.clear(); // di-regenerasi dari codex; jangan dipulihkan dari backup
        await db.sceneEmbeddings.clear(); // indeks Pencarian Semantik; di-regenerasi on-demand

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
        if (data.plotPromises?.length) await db.plotPromises.bulkAdd(data.plotPromises);
        if (data.glossary?.length) await db.glossary.bulkAdd(data.glossary);
        if (mapRows.length) await db.maps.bulkAdd(mapRows);
        if (data.mapMarkers?.length) await db.mapMarkers.bulkAdd(data.mapMarkers);
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
   * Impor SATU novel dari file ekspor per-proyek (#4B) sebagai proyek BARU —
   * NON-DESTRUKTIF: hanya menambah baris, tak pernah clear/update/delete, sehingga
   * proyek lain tak tersentuh (undo = hapus proyek lewat ProjectContext.deleteProject).
   *
   * Karena PK numerik auto-increment tak unik lintas-ekspor, tiap baris di-insert TANPA
   * id lama (Dexie menetapkan id baru); proyek→bab→codex di-insert lebih dulu untuk
   * membangun peta id, lalu FK 7 tabel dependen ditulis ulang oleh remapProjectDependents
   * (murni, teruji). Seluruhnya dalam satu transaksi (gagal → rollback).
   *
   * Pemanggil bertanggung jawab menyegarkan konteks (invalidateContextCache) & berpindah
   * ke proyek baru — service ini sengaja bebas dependensi pada worker/konteks.
   */
  async importProjectData(backup: BackupData): Promise<{ projectId: number; counts: ProjectBackupCounts }> {
    validateProjectBackup(backup);

    // Verifikasi integritas (#5), pola sama dgn restoreData — sebelum menyentuh DB.
    if (backup.checksum) {
      const actual = await this.computeChecksum(JSON.stringify(backup.data));
      if (actual && actual !== backup.checksum) {
        throw new Error('Verifikasi integritas gagal: cadangan tampak rusak atau tidak lengkap.');
      }
    }

    const data = backup.data as unknown as ProjectBackupData;
    const counts = summarizeProjectBackup(data);

    // Dekode gambar peta di LUAR transaksi (fetch async); id lama dipertahankan untuk
    // membangun mapIdMap saat insert.
    const decodedMaps = await this.deserializeMaps(data.maps);

    // Salin baris tanpa id, set projectId. (id dilepas → Dexie menetapkan id baru.)
    const prep = (row: any, projectId: number) => {
      const copy = { ...row };
      delete copy.id;
      copy.projectId = projectId;
      return copy;
    };

    let newProjectId = 0;
    await db.transaction('rw',
      [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships, db.chatSessions, db.codexCategories, db.plotPromises, db.glossary, db.maps, db.mapMarkers],
      async () => {
        // 1) Proyek baru (lepas id; lastOpened=now agar langsung teratas; nama diberi
        //    suffix "(impor)" agar terbedakan dari aslinya bila keduanya berdampingan).
        const projectRow = { ...data.projects[0] } as any;
        delete projectRow.id;
        projectRow.name = importedProjectName(projectRow.name);
        projectRow.lastOpened = Date.now();
        newProjectId = await db.projects.add(projectRow) as number;

        // 2) Bab & codex di-insert dulu untuk MEMBANGUN peta id lama→baru.
        const chapterIdMap = new Map<number, number>();
        if (data.chapters?.length) {
          const rows = data.chapters.map((c) => prep(c, newProjectId));
          const keys = await db.chapters.bulkAdd(rows, { allKeys: true });
          data.chapters.forEach((c, i) => { if (c.id != null) chapterIdMap.set(c.id, keys[i] as number); });
        }

        const codexIdMap = new Map<number, number>();
        if (data.codex?.length) {
          const rows = data.codex.map((c) => prep(c, newProjectId));
          const keys = await db.codex.bulkAdd(rows, { allKeys: true });
          data.codex.forEach((c, i) => { if (c.id != null) codexIdMap.set(c.id, keys[i] as number); });
        }

        // 2b) Peta Atlas di-insert dulu (seperti bab/codex) untuk membangun mapIdMap
        //     yang dipakai remap mapMarkers. Gambar sudah didekode jadi Blob.
        const mapIdMap = new Map<number, number>();
        if (decodedMaps.length) {
          const rows = decodedMaps.map((m) => prep(m, newProjectId));
          const keys = await db.maps.bulkAdd(rows, { allKeys: true });
          decodedMaps.forEach((m, i) => { if (m.id != null) mapIdMap.set(m.id, keys[i] as number); });
        }

        // 3) Remap FK tabel dependen (murni) lalu insert.
        const dep = remapProjectDependents(data, { projectId: newProjectId, chapterIdMap, codexIdMap, mapIdMap });
        if (dep.bible.length) await db.bible.bulkAdd(dep.bible);
        if (dep.aiActions.length) await db.aiActions.bulkAdd(dep.aiActions);
        if (dep.codexCategories.length) await db.codexCategories.bulkAdd(dep.codexCategories);
        if (dep.snapshots.length) await db.snapshots.bulkAdd(dep.snapshots);
        if (dep.timeline.length) await db.timeline.bulkAdd(dep.timeline);
        if (dep.relationships.length) await db.relationships.bulkAdd(dep.relationships);
        if (dep.chatSessions.length) await db.chatSessions.bulkAdd(dep.chatSessions);
        if (dep.plotPromises.length) await db.plotPromises.bulkAdd(dep.plotPromises);
        if (dep.glossary.length) await db.glossary.bulkAdd(dep.glossary);
        if (dep.mapMarkers.length) await db.mapMarkers.bulkAdd(dep.mapMarkers);
      });

    return { projectId: newProjectId, counts };
  },

  /**
   * Returns list of internal backups, sorted by newest.
   */
  async getBackupList(): Promise<BackupRecord[]> {
    return db.backups.orderBy('timestamp').reverse().toArray();
  }
};
