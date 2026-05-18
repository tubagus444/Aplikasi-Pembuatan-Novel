/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { backupService } from '@/src/services/backupService';

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
    try {
      const data = await backupService.collectAllData();
      
      // Layer 1: Internal DB
      await backupService.saveToInternalDB(data);
      
      // Layer 2: External Folder (if selected)
      if (directoryHandleRef.current) {
        try {
          await backupService.saveToDirectory(data, directoryHandleRef.current);
        } catch (err) {
          console.error("External backup failed:", err);
        }
      }
      
      const now = Date.now();
      setLastBackupTime(now);
      localStorage.setItem('last_backup_time', now.toString());
    } catch (error) {
      console.error("Auto-backup failed:", error);
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp]);

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
