import React, { useState, useRef } from 'react';
import { Upload, Download, Database, FileArchive } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { backupService, BackupData } from '@/src/services/backupService';
import { useProject } from '@/src/contexts/ProjectContext';
import { useToast } from '@/src/hooks/useToast';
import { ConfirmDialog } from '@/src/components/common/ConfirmDialog';

export function ManualBackupSection() {
  const { toast } = useToast();
  const { projectId: activeProjectId } = useProject();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExportingProject, setIsExportingProject] = useState(false);
  // null = ikut proyek aktif; angka = pilihan eksplisit dari dropdown.
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  // Cadangan yang sudah di-parse & tervalidasi, menunggu konfirmasi pengguna.
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projects = useLiveQuery(() => db.projects.orderBy('lastOpened').reverse().toArray(), []);
  const effectiveProjectId = selectedProjectId ?? activeProjectId ?? projects?.[0]?.id ?? null;

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      // Satu sumber kebenaran: termasuk chatSessions & versi terbaru.
      const backup = await backupService.collectAllData();

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aetherscribe-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Cadangan berhasil diekspor.');
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error('Gagal membuat cadangan. Lihat konsol untuk detailnya.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Ekspor satu novel sebagai file mandiri (#4). Berbeda dari "Ekspor Semua": hanya
  // proyek terpilih, cocok untuk arsip / memindahkan satu novel.
  const handleExportProject = async () => {
    if (effectiveProjectId == null) return;
    setIsExportingProject(true);
    try {
      const backup = await backupService.collectProjectData(effectiveProjectId);
      const safeName = (backup.projectName || 'proyek')
        .replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'proyek';
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aetherscribe-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Novel “${backup.projectName}” berhasil diekspor.`);
    } catch (error) {
      console.error('Failed to export project:', error);
      toast.error('Gagal mengekspor novel. Lihat konsol untuk detailnya.');
    } finally {
      setIsExportingProject(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  // Parse & validasi file, lalu buka dialog konfirmasi (tanpa menyentuh DB dulu).
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Deteksi gzip lewat magic bytes (0x1f 0x8b), bukan ekstensi — robust untuk
      // cadangan lama yang salah dinamai `.json.gz` padahal mentah, maupun `.json`
      // tak terkompresi (BK4).
      const buffer = await file.arrayBuffer();
      const head = new Uint8Array(buffer.slice(0, 2));
      const isGzip = head[0] === 0x1f && head[1] === 0x8b;

      let content = '';
      if (isGzip) {
        // @ts-ignore
        const decompressedStream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
        content = await new Response(decompressedStream).text();
      } else {
        content = new TextDecoder().decode(buffer);
      }

      const backup = JSON.parse(content);

      if (!backup.data || !backup.data.projects) {
        throw new Error("Format file cadangan tidak valid");
      }

      // Guard (#4): jalur ini adalah restore-PENUH (meng-clear semua tabel). File ekspor
      // satu proyek akan menghapus proyek lain bila dipulihkan di sini — tolak sampai
      // impor per-proyek (remap id) tersedia.
      if (backup.scope === 'project') {
        toast.error(
          `Ini file ekspor satu novel${backup.projectName ? ` (“${backup.projectName}”)` : ''}. ` +
          'Memulihkannya di sini akan menimpa SEMUA proyek — fitur impor per-novel belum tersedia.'
        );
        resetFileInput();
        return;
      }

      setPendingRestore(backup);
    } catch (error) {
      console.error('Failed to read backup:', error);
      toast.error('Gagal membaca file cadangan. Pastikan ini file JSON (atau .json.gz) yang valid.');
      resetFileInput();
    }
  };

  const confirmRestore = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    try {
      // Satu sumber kebenaran restore (verifikasi checksum + snapshot pra-pemulihan
      // + clear semua tabel, atomik). Lihat backupService.restoreData.
      await backupService.restoreData(pendingRestore);
      setPendingRestore(null);
      toast.success('Pemulihan berhasil! Memuat ulang…');
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error('Failed to restore backup:', error);
      // Surfacing pesan spesifik kegagalan verifikasi integritas (#5); selain itu pesan generik.
      const msg = error instanceof Error && error.message.includes('integritas')
        ? error.message
        : 'Gagal memulihkan dari file cadangan.';
      toast.error(msg);
      setIsRestoring(false);
      setPendingRestore(null);
      resetFileInput();
    }
  };

  const cancelRestore = () => {
    setPendingRestore(null);
    resetFileInput();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Database size={18} className="text-indigo-500" />
        <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">Operasi Manual</h3>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ekspor seluruh ruang kerja Anda atau pulihkan dari cadangan JSON yang ada. Memulihkan akan menimpa data yang ada.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            <Download size={18} className="text-slate-500 dark:text-slate-400" />
            {isBackingUp ? 'Mengekspor...' : 'Ekspor Semua Cadangan'}
          </button>

          <input
            type="file"
            accept=".json,.gz"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={handleRestoreClick}
            disabled={isRestoring}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            <Upload size={18} className="text-slate-500 dark:text-slate-400" />
            {isRestoring ? 'Memulihkan...' : 'Kembalikan dari JSON'}
          </button>
        </div>
      </div>

      {/* Ekspor per-proyek (#4): arsipkan/pindahkan satu novel sebagai file mandiri. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <FileArchive size={16} className="text-indigo-500" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ekspor Per-Novel</h4>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ekspor <strong>satu novel saja</strong> sebagai file mandiri — cocok untuk arsip atau memindahkannya.
          Impor per-novel menyusul; untuk saat ini file ini hanya bisa diarsipkan.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={effectiveProjectId ?? ''}
            onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            disabled={isExportingProject || !projects?.length}
            className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm transition-colors disabled:opacity-50"
          >
            {projects?.length
              ? projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))
              : <option value="">Tidak ada proyek</option>}
          </select>

          <button
            onClick={handleExportProject}
            disabled={isExportingProject || effectiveProjectId == null}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            <Download size={18} className="text-slate-500 dark:text-slate-400" />
            {isExportingProject ? 'Mengekspor...' : 'Ekspor Novel Ini'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRestore !== null}
        tone="danger"
        title="Timpa semua data?"
        confirmLabel="Ya, pulihkan"
        busy={isRestoring}
        onConfirm={confirmRestore}
        onCancel={cancelRestore}
        message={
          <>
            Ini akan <strong>menimpa SEMUA proyek, bab, dan entri</strong> Anda saat ini dengan data dari file cadangan.
            Sebuah titik <strong>“Sebelum pemulihan”</strong> otomatis dibuat agar Anda bisa membatalkannya.
          </>
        }
      />
    </section>
  );
}
