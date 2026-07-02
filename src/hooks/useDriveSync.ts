import { useState, useEffect, useCallback } from 'react';
import { initAuth, googleSignIn, logout, getAccessToken, GoogleUser } from '../services/googleAuth';
import { syncProjectToDrive, listDriveBackups, restoreFromDrive, DriveBackupFile } from '../services/driveBackupService';

export function useDriveSync() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[] | null>(null);
  const [isLoadingDriveBackups, setIsLoadingDriveBackups] = useState(false);
  const [isRestoringDrive, setIsRestoringDrive] = useState(false);

  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
  }, []);

  const handleLogin = async () => {
    const clientId = localStorage.getItem('google_client_id');
    if (!clientId) {
       alert("Silakan masukkan Google Client ID di Pengaturan terlebih dahulu.");
       return;
    }
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn(clientId);
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setDriveBackups(null);
  };

  const handleExpiredSession = () => {
    setNeedsAuth(true);
    setUser(null);
    setDriveBackups(null);
  };

  // Muat daftar cadangan Drive. Dipanggil otomatis saat terautentikasi (efek di
  // bawah) dan lewat tombol "Segarkan".
  const loadDriveBackups = useCallback(async () => {
    setIsLoadingDriveBackups(true);
    try {
      const files = await listDriveBackups();
      setDriveBackups(files);
    } catch (err) {
      console.error('Failed to load drive backups', err);
      if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
        handleExpiredSession();
        alert('Sesi Google Anda telah berakhir. Harap login ulang untuk melihat cadangan Drive.');
      } else {
        alert('Gagal memuat daftar cadangan dari Google Drive.');
      }
    } finally {
      setIsLoadingDriveBackups(false);
    }
  }, []);

  // Auto-muat daftar begitu sesi aktif agar Titik Pulih Drive langsung tampil.
  useEffect(() => {
    if (!needsAuth) loadDriveBackups();
  }, [needsAuth, loadDriveBackups]);

  const restoreDriveBackup = async (fileId: string, label: string) => {
    const confirmRestore = window.confirm(
      `PERINGATAN: Ini akan menimpa SEMUA data Anda saat ini dengan cadangan Google Drive dari ${label}. Tindakan ini tidak dapat dibatalkan.\n\nApakah Anda yakin ingin melanjutkan?`
    );
    if (!confirmRestore) return;

    setIsRestoringDrive(true);
    try {
      await restoreFromDrive(fileId);
      alert('Pemulihan dari Google Drive berhasil! Halaman akan dimuat ulang.');
      window.location.reload();
    } catch (err) {
      console.error('Drive restore failed', err);
      if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
        handleExpiredSession();
        alert('Sesi Google Anda telah berakhir. Harap login ulang untuk memulihkan.');
      } else if (err instanceof Error && err.message.includes('integritas')) {
        alert(err.message); // Verifikasi integritas gagal (#5)
      } else {
        alert('Gagal memulihkan dari Google Drive. Pastikan file cadangan valid.');
      }
      setIsRestoringDrive(false);
    }
  };

  const triggerDriveSync = async () => {
    setIsSyncing(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }
      
      // Use trigger a full DB backup
      const driveSuccess = await syncProjectToDrive();
      if (!driveSuccess) {
         throw new Error("DRIVE_SYNC_FAILED");
      }
      alert('Berhasil disinkronisasi ke Google Drive!');
      loadDriveBackups();
    } catch (err) {
      console.error('Drive sync failed', err);
      if (err instanceof Error && err.message === 'CONFLICT_DETECTED') {
         const force = window.confirm("Konflik: Ditemukan cadangan yang lebih baru di Google Drive (mungkin diedit di perangkat lain). Menimpa sekarang dapat menghilangkan data yang ada di Drive.\n\nApakah Anda ingin MENIMPA cadangan di Google Drive dengan versi lokal ini?");
         if (force) {
            try {
               const forceSuccess = await syncProjectToDrive(true);
               if (!forceSuccess) throw new Error("DRIVE_SYNC_FAILED");
               alert('Berhasil menimpa cadangan di Google Drive!');
               loadDriveBackups();
            } catch (forceErr) {
               console.error('Forced drive sync failed', forceErr);
               alert('Gagal menyinkronkan (timpa) ke Google Drive.');
            }
         } else {
            alert('Sinkronisasi dibatalkan. Jika Anda ingin menarik versi terbaru, gunakan menu "Kembalikan dari JSON" setelah mengunduhnya dari folder AetherScribe Backups di Drive.');
         }
      } else if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
         alert('Sesi Google Anda telah berakhir. Harap login ulang untuk melanjutkan sinkronisasi.');
         setNeedsAuth(true);
         setUser(null);
      } else {
         alert('Gagal menyinkronkan ke Google Drive.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    needsAuth,
    user,
    isLoggingIn,
    isSyncing,
    handleLogin,
    handleLogout,
    triggerDriveSync,
    driveBackups,
    isLoadingDriveBackups,
    isRestoringDrive,
    loadDriveBackups,
    restoreDriveBackup
  };
}
