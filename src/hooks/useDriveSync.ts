import { useState, useEffect } from 'react';
import { initAuth, googleSignIn, logout, getAccessToken } from '../services/googleAuth';
import { User } from 'firebase/auth';
import { syncProjectToDrive } from '../services/driveBackupService';

export function useDriveSync() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsub = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
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
      
      // Use 0 or -1 to just trigger a full DB backup without specific project ID since collectAllData ignores it basically
      await syncProjectToDrive(0);
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
