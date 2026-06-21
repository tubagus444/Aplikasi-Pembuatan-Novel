/**
 * Penyimpanan persisten untuk FileSystemDirectoryHandle cadangan (BK6).
 *
 * Handle dari File System Access API bersifat structured-cloneable sehingga bisa
 * disimpan di IndexedDB. Dipisah dari Dexie (`AetherScribeDB`) ke database mini
 * sendiri agar tak perlu menaikkan versi skema Dexie hanya untuk satu nilai.
 *
 * Catatan izin: izin yang diberikan TIDAK otomatis bertahan antar reload — setelah
 * reload statusnya jadi `'prompt'` dan harus di-`requestPermission` ulang dalam
 * gesture pengguna. Store ini menjaga handle-nya tetap ada sehingga folder tetap
 * "terkonfigurasi" dan cukup satu klik untuk mengaktifkan kembali, alih-alih
 * pengguna harus menavigasi ulang picker direktori.
 */

const DB_NAME = 'AetherScribeHandles';
const STORE = 'kv';
const KEY = 'backupDir';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Gagal menyimpan handle folder cadangan:', err);
  }
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch (err) {
    console.warn('Gagal memuat handle folder cadangan:', err);
    return null;
  }
}

export async function clearFolderHandle(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Gagal menghapus handle folder cadangan:', err);
  }
}

/**
 * Pastikan izin baca-tulis pada handle.
 * @param interactive bila true, boleh memunculkan prompt izin (HARUS dipanggil
 *   dalam gesture pengguna). Bila false (mis. backup terjadwal), hanya mengecek
 *   status tanpa prompt — mengembalikan false bila belum diizinkan agar tak spam.
 */
export async function ensureDirPermission(
  handle: FileSystemDirectoryHandle,
  interactive: boolean
): Promise<boolean> {
  const opts = { mode: 'readwrite' } as const;
  try {
    const anyHandle = handle as any;
    if ((await anyHandle.queryPermission(opts)) === 'granted') return true;
    if (interactive && (await anyHandle.requestPermission(opts)) === 'granted') return true;
    return false;
  } catch (err) {
    console.warn('Gagal memeriksa izin folder cadangan:', err);
    return false;
  }
}
