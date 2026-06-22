import React, { useState, useRef } from 'react';
import { Upload, Download, Database } from 'lucide-react';
import { backupService } from '@/src/services/backupService';

export function ManualBackupSection() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (error) {
      console.error('Failed to create backup:', error);
      alert('Gagal membuat cadangan. Lihat konsol untuk detailnya.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);

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

      const confirmRestore = window.confirm(
        "PERINGATAN: Ini akan menimpa SEMUA proyek, bab, entri kamus data, dan pengaturan Anda dengan data dari file cadangan. Tindakan ini tidak dapat dibatalkan.\n\nApakah Anda yakin ingin melanjutkan?"
      );

      if (!confirmRestore) {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Satu sumber kebenaran restore (clear semua tabel + chatSessions + embeddings, atomik).
      await backupService.restoreData(backup);

      alert("Pemulihan berhasil! Halaman akan dimuat ulang.");
      window.location.reload();
    } catch (error) {
      console.error('Failed to restore backup:', error);
      alert('Gagal memulihkan dari file cadangan. Pastikan ini adalah file JSON (atau .json.gz) cadangan yang valid.');
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    </section>
  );
}
