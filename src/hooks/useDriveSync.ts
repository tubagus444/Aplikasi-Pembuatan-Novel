import { useState, useEffect } from 'react';
import { initAuth, googleSignIn, logout, getAccessToken, GoogleUser } from '../services/googleAuth';
import { syncProjectToDrive } from '../services/driveBackupService';

export function useDriveSync() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
    } catch (err) {
      console.error('Drive sync failed', err);
      if (err instanceof Error && err.message === 'CONFLICT_DETECTED') {
         const force = window.confirm("Konflik: Ditemukan cadangan yang lebih baru di Google Drive (mungkin diedit di perangkat lain). Menimpa sekarang dapat menghilangkan data yang ada di Drive.\n\nApakah Anda ingin MENIMPA cadangan di Google Drive dengan versi lokal ini?");
         if (force) {
            try {
               const forceSuccess = await syncProjectToDrive(true);
               if (!forceSuccess) throw new Error("DRIVE_SYNC_FAILED");
               alert('Berhasil menimpa cadangan di Google Drive!');
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
    triggerDriveSync
  };
}
