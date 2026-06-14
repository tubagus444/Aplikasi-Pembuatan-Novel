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
      await syncProjectToDrive();
      alert('Berhasil disinkronisasi ke Google Drive!');
    } catch (err) {
      console.error('Drive sync failed', err);
      alert('Gagal menyinkronkan ke Google Drive.');
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
