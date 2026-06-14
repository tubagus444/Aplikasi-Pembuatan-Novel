/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { backupService } from '@/src/services/backupService';
import { syncProjectToDrive } from '@/src/services/driveBackupService';
import { getAccessToken } from '@/src/services/googleAuth';
import { useToast } from '@/src/hooks/useToast';

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

  const triggerManualBackup = useCallback(async () => {
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
        toast.error("Failed to backup to local storage.");
        hasError = true;
      }
      
      // Layer 2: External Folder (if selected)
      if (directoryHandleRef.current) {
        try {
          await backupService.saveToDirectory(data, directoryHandleRef.current);
        } catch (err) {
          console.error("External backup failed:", err);
          toast.error("Failed to backup to selected folder. Check folder permissions.");
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
        }
      } catch (err) {
        console.error("Google Drive sync failed:", err);
        if (err instanceof Error && err.message === 'CONFLICT_DETECTED') {
           toast.error("Konflik Google Drive: Versi remote lebih baru! Harap sinkronkan manual.");
        } else if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
           toast.error("Sesi Google Anda telah berakhir. Harap login ulang di Pengaturan untuk melanjutkan pencadangan.");
        } else {
           toast.error("Failed to backup to Google Drive.");
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
      toast.error("Auto-backup failed unexpectedly.");
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp, toast]);

  const selectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      directoryHandleRef.current = handle;
      setFolderName(handle.name);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("Failed to select folder:", err);
      }
    }
  };

  useEffect(() => {
    const runBackupTask = () => {
      idleRef.current = idleCallback(() => {
        triggerManualBackup();
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
  }, [triggerManualBackup]);

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
