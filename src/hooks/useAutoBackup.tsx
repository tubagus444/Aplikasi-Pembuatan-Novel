/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { backupService } from '@/src/services/backupService';
import { syncProjectToDrive } from '@/src/services/driveBackupService';
import { getAccessToken } from '@/src/services/googleAuth';
import { useToast } from '@/src/hooks/useToast';
import { saveFolderHandle, loadFolderHandle, ensureDirPermission } from '@/src/lib/folderHandleStore';

// Shim for requestIdleCallback
const idleCallback = (cb: IdleRequestCallback) => {
  if ('requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(cb);
  }
  return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
};

const cancelIdle = (id: number) => {
  if ('cancelIdleCallback' in window) {
    return (window as any).cancelIdleCallback(id);
  }
  clearTimeout(id);
};

interface BackupContextType {
  lastBackupTime: number | null;
  isBackingUp: boolean;
  selectFolder: () => Promise<void>;
  triggerManualBackup: () => Promise<void>;
  folderName: string | null;
  isFileSystemSupported: boolean;
}

const BackupContext = createContext<BackupContextType | undefined>(undefined);

export function BackupProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(() => {
    const stored = localStorage.getItem('last_backup_time');
    return stored ? parseInt(stored) : null;
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const idleRef = useRef<number | null>(null);
  // BK10: cegah spam toast konflik/sesi-berakhir tiap siklus auto-backup; cukup
  // beri tahu sekali sampai sync berhasil (atau pengguna bertindak manual).
  const driveNoticeShownRef = useRef(false);

  // Inti backup. `isAuto` membedakan siklus terjadwal (boleh diam saat izin folder
  // belum diberi; notifikasi Drive di-dedup) dari aksi manual (gesture pengguna →
  // boleh prompt izin folder & selalu beri umpan balik).
  const runBackup = useCallback(async (isAuto: boolean) => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    let hasError = false;
    try {
      const data = await backupService.collectAllData();

      // Layer 1: Internal DB
      try {
        await backupService.saveToInternalDB(data);
      } catch (err) {
        console.error("Internal DB backup failed:", err);
        toast.error("Gagal mencadangkan ke penyimpanan lokal.");
        hasError = true;
      }

      // Layer 2: External Folder (if selected)
      if (directoryHandleRef.current) {
        const handle = directoryHandleRef.current;
        // Izin folder bisa hilang setelah reload (BK6): minta ulang hanya saat aksi
        // manual (gesture); saat auto, lewati diam-diam bila belum diizinkan.
        const allowed = await ensureDirPermission(handle, !isAuto);
        if (allowed) {
          try {
            await backupService.saveToDirectory(data, handle);
          } catch (err) {
            console.error("External backup failed:", err);
            toast.error("Gagal mencadangkan ke folder terpilih. Periksa izin folder.");
            hasError = true;
          }
        } else if (!isAuto) {
          toast.error("Izin folder cadangan dibutuhkan. Pilih ulang folder untuk mengaktifkan kembali.");
          hasError = true;
        }
      }

      // Layer 3: Google Drive (if authenticated)
      try {
        const token = await getAccessToken();
        if (token) {
          const driveSuccess = await syncProjectToDrive();
          if (!driveSuccess) {
            throw new Error("DRIVE_SYNC_FAILED");
          }
          driveNoticeShownRef.current = false; // sync sukses → izinkan notifikasi lagi
        }
      } catch (err) {
        console.error("Google Drive sync failed:", err);
        const isConflict = err instanceof Error && err.message === 'CONFLICT_DETECTED';
        const isExpired = err instanceof Error && err.message === 'TOKEN_EXPIRED';
        // Untuk konflik/sesi-berakhir saat auto: tampilkan sekali saja (BK10).
        const suppress = isAuto && (isConflict || isExpired) && driveNoticeShownRef.current;
        if (!suppress) {
          if (isConflict) {
            toast.error("Konflik Google Drive: Versi remote lebih baru! Harap sinkronkan manual.");
          } else if (isExpired) {
            toast.error("Sesi Google Anda telah berakhir. Harap login ulang di Pengaturan untuk melanjutkan pencadangan.");
          } else {
            toast.error("Gagal mencadangkan ke Google Drive.");
          }
          if (isConflict || isExpired) driveNoticeShownRef.current = true;
        }
        hasError = true;
      }

      if (!hasError) {
        const now = Date.now();
        setLastBackupTime(now);
        localStorage.setItem('last_backup_time', now.toString());
      }
    } catch (error) {
      console.error("Auto-backup failed:", error);
      toast.error("Pencadangan gagal tak terduga.");
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp, toast]);

  const triggerManualBackup = useCallback(() => runBackup(false), [runBackup]);

  const selectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      directoryHandleRef.current = handle;
      setFolderName(handle.name);
      await saveFolderHandle(handle); // BK6: bertahan antar reload
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("Failed to select folder:", err);
      }
    }
  };

  // BK6: pulihkan handle folder yang tersimpan saat mount agar konfigurasi folder
  // tak hilang setelah reload (izinnya diaktifkan ulang saat backup manual berikutnya).
  useEffect(() => {
    let cancelled = false;
    loadFolderHandle().then((handle) => {
      if (!cancelled && handle) {
        directoryHandleRef.current = handle;
        setFolderName(handle.name);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const runBackupTask = () => {
      idleRef.current = idleCallback(() => {
        runBackup(true);
      });
    };

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      
      const intervalMinutes = parseInt(localStorage.getItem('backup_interval') || '30');
      const intervalMs = intervalMinutes * 60 * 1000;
      
      timerRef.current = setInterval(runBackupTask, intervalMs);
    };

    startTimer();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'backup_interval') {
        startTimer();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (idleRef.current) cancelIdle(idleRef.current);
      window.removeEventListener('storage', handleStorage);
    };
  }, [runBackup]);

  return (
    <BackupContext.Provider value={{
      lastBackupTime,
      isBackingUp,
      selectFolder,
      triggerManualBackup,
      get folderName() { return folderName; },
      isFileSystemSupported: 'showDirectoryPicker' in window
    }}>
      {children}
    </BackupContext.Provider>
  );
}

export function useAutoBackup() {
  const context = useContext(BackupContext);
  if (context === undefined) {
    throw new Error('useAutoBackup must be used within a BackupProvider');
  }
  return context;
}
