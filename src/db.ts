/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { Table } from 'dexie';
import { Chapter, Project, CodexEntry, StoryBibleRule, AIAction, Snapshot, TimelineEvent, Relationship, AppError, BackupRecord, ChatSession, VectorEmbedding, AIUsageLog, CustomCategory, SceneEmbedding, PlotPromise } from '@/src/types';

export class AetherScribeDB extends Dexie {
  projects!: Table<Project>;
  chapters!: Table<Chapter>;
  codex!: Table<CodexEntry>;
  bible!: Table<StoryBibleRule>;
  aiActions!: Table<AIAction>;
  snapshots!: Table<Snapshot>;
  timeline!: Table<TimelineEvent>;
  relationships!: Table<Relationship>;
  errors!: Table<AppError>;
  backups!: Table<BackupRecord>;
  chatSessions!: Table<ChatSession>;
  embeddings!: Table<VectorEmbedding>;
  aiUsageLogs!: Table<AIUsageLog>;
  codexCategories!: Table<CustomCategory>;
  sceneEmbeddings!: Table<SceneEmbedding>;
  plotPromises!: Table<PlotPromise>;

  constructor() {
    super('AetherScribeDB');
    // Baseline sengaja dimulai di v10 (definisi <v10 sudah dihapus). Untuk fresh
    // install, Dexie membangun bertahap v10→v17 sehingga seluruh tabel terbentuk
    // mulai v11. v10 dipertahankan karena memiliki .upgrade() (dedup bible).
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

    // Catatan: v15 identik dengan v14 (no-op version bump historis). JANGAN dihapus —
    // menghapus versi tengah dapat memicu jalur upgrade ulang bagi DB yang sudah di v15+.
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

    // v18: skema identik dengan v17 (field `kind` tidak diindeks). Upgrade hanya
    // backfill: men-tag sesi Scribble lama yang dibuat sebelum field `kind` ada,
    // agar tidak lagi mencemari daftar riwayat Studio. Diskriminasi via pola judul
    // auto-generate Scribble ("Global Scribble" / "Chapter N Scribble") — sesi
    // Studio bertajuk prompt pengguna / "Percakapan Baru".
    this.version(18).stores({
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
    }).upgrade(async (tx) => {
      const sessions = await tx.table('chatSessions').toArray();
      let scribbleCount = 0;
      await Promise.all(sessions.map((s: ChatSession) => {
        if (s.kind) return Promise.resolve(); // sesi baru sudah ter-tag
        const isScribble = /Scribble$/.test(s.title);
        if (isScribble) scribbleCount++;
        return tx.table('chatSessions').update(s.id, { kind: isScribble ? 'scribble' : 'studio' });
      }));
      if (scribbleCount > 0) {
        console.log(`Tagged ${scribbleCount} legacy Scribble session(s) as kind:'scribble'.`);
      }
    });

    // v19: tabel baru `codexCategories` untuk kategori Codex kustom per-proyek.
    // Append-only; tidak ada migrasi data (entri lama tetap memakai slug bawaan).
    this.version(19).stores({
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
      aiUsageLogs: '++id, timestamp, provider, actionType',
      codexCategories: '++id, projectId, slug, &[projectId+slug]'
    });

    // v20: tabel baru `sceneEmbeddings` untuk Pencarian Semantik naskah (cari adegan
    // per makna). Append-only; tidak ada migrasi data (indeks dibangun on-demand di
    // panel, inkremental via contentHash per chunk).
    this.version(20).stores({
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
      aiUsageLogs: '++id, timestamp, provider, actionType',
      codexCategories: '++id, projectId, slug, &[projectId+slug]',
      sceneEmbeddings: 'id, projectId, chapterId, [projectId+chapterId]'
    });

    // v21: tabel baru `plotPromises` untuk Pelacak Janji Plot (Chekhov's Gun).
    // Append-only; tidak ada migrasi data. Status turunan (tertidur/aktif) dihitung
    // on-demand di panel via PresenceIndex — tak disimpan.
    this.version(21).stores({
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
      aiUsageLogs: '++id, timestamp, provider, actionType',
      codexCategories: '++id, projectId, slug, &[projectId+slug]',
      sceneEmbeddings: 'id, projectId, chapterId, [projectId+chapterId]',
      plotPromises: '++id, projectId, codexId'
    });

    // v22: field baru `hidden`/`secret` di CodexEntry untuk Lapis "Kebenaran
    // Tersembunyi" (kanon vs rahasia penulis). Keduanya opsional & TIDAK diindeks
    // (penyaringan dilakukan on-demand di konsumen, bukan lewat query index) →
    // skema identik dengan v21, append-only, tanpa migrasi data.
    this.version(22).stores({
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
      aiUsageLogs: '++id, timestamp, provider, actionType',
      codexCategories: '++id, projectId, slug, &[projectId+slug]',
      sceneEmbeddings: 'id, projectId, chapterId, [projectId+chapterId]',
      plotPromises: '++id, projectId, codexId'
    });

    // v23: field baru `payoffCodexId` di PlotPromise (Janji Plot → payoff/reveal, #2).
    // Tautan agregasi ke entri Codex yang dibayar — TIDAK diindeks (pengelompokan
    // on-demand di panel atas promises yang sudah dimuat) → skema identik dengan v22,
    // append-only, tanpa migrasi data.
    this.version(23).stores({
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
      aiUsageLogs: '++id, timestamp, provider, actionType',
      codexCategories: '++id, projectId, slug, &[projectId+slug]',
      sceneEmbeddings: 'id, projectId, chapterId, [projectId+chapterId]',
      plotPromises: '++id, projectId, codexId'
    });

    // v24: field baru `namePalette` di CodexEntry (Bengkel Nama, #3). JSON inert
    // (BUKAN FK, tak diindeks) → skema identik dengan v23, append-only, tanpa migrasi.
    this.version(24).stores({
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
      aiUsageLogs: '++id, timestamp, provider, actionType',
      codexCategories: '++id, projectId, slug, &[projectId+slug]',
      sceneEmbeddings: 'id, projectId, chapterId, [projectId+chapterId]',
      plotPromises: '++id, projectId, codexId'
    });
  }
}

export const db = new AetherScribeDB();

// --- Ketahanan koneksi DB (multi-tab & upgrade) ---
// db.ts dimuat juga di context worker & orama worker → ada koneksi IndexedDB ganda.
// Tanpa handler ini, upgrade skema bisa menggantung diam-diam (blocked) atau gagal
// senyap (VersionError) dan baru muncul sebagai error di query pertama.
// Catatan: JANGAN memakai ErrorService di sini — ia menulis ke db.errors, sehingga
// saat DB justru bermasalah, logging bisa ikut menggantung. Pakai console + event.
function notifyDbIssue(level: 'warning' | 'error', message: string) {
  if (level === 'error') console.error(`[DB] ${message}`);
  else console.warn(`[DB] ${message}`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aetherscribe-db-issue', { detail: { level, message } }));
  }
}

// Tab/koneksi lain ingin upgrade ke skema lebih baru → tutup koneksi ini agar
// upgrade-nya bisa lanjut. Di main thread, muat ulang agar memakai skema/kode terbaru.
db.on('versionchange', () => {
  db.close();
  if (typeof window !== 'undefined') {
    notifyDbIssue('warning', 'Database diperbarui di tab lain. Memuat ulang halaman…');
    window.location.reload();
  }
});

// Upgrade di koneksi ini terblokir oleh koneksi lama yang belum menutup (tab lain).
db.on('blocked', () => {
  notifyDbIssue('warning', 'Pembaruan database terblokir. Tutup tab AetherScribe lain agar pembaruan selesai.');
});

// Buka eksplisit untuk menangkap kegagalan (VersionError/kuota/korup) lebih awal.
db.open().catch((err: any) => {
  notifyDbIssue('error', 'Gagal membuka database: ' + (err?.message || String(err)));
});

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

