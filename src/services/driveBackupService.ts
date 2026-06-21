import { getAccessToken } from './googleAuth';
import { db } from '../db';
import { backupService } from './backupService';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

const FOLDER_NAME = 'AetherScribe Backups';
const MAX_BACKUPS = 5;

// Get or create the AetherScribe folder
async function getAppFolder(accessToken: string): Promise<string | null> {
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`${DRIVE_API_URL}?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    console.error('Failed to search for app folder', await res.text());
    return null;
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  const createRes = await fetch(DRIVE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
     if (createRes.status === 401) throw new Error('TOKEN_EXPIRED');
     console.error('Failed to create app folder', await createRes.text());
     return null;
  }

  const createData = await createRes.json();
  return createData.id;
}

// Upload a single project backup with Versioning and Compression
export async function syncProjectToDrive(force: boolean = false): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  const folderId = await getAppFolder(accessToken);
  if (!folderId) return false;

  // File Versioning: Find existing files to rotate
  const listQuery = `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const listRes = await fetch(`${DRIVE_API_URL}?q=${encodeURIComponent(listQuery)}&orderBy=createdTime desc&fields=files(id,name,createdTime)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!listRes.ok) {
    if (listRes.status === 401) throw new Error('TOKEN_EXPIRED');
  }
  const listData = await listRes.json();
  const files = listData.files || [];

  // Check for conflicts
  if (!force && files.length > 0) {
    const latestRemote = files[0].createdTime;
    const lastSyncTimeStr = localStorage.getItem('last_drive_sync_time');
    
    // If we have a local record of syncing, but remote has a newer file
    if (lastSyncTimeStr) {
      const lastSyncTime = new Date(lastSyncTimeStr).getTime();
      const remoteTime = new Date(latestRemote).getTime();
      
      // Give a tiny buffer (e.g. 5 seconds) to avoid timezone/clock drift precision issues if needed, 
      // but comparing ISO 8601 strings or epoch ms directly is standard.
      // If remote file is definitively newer than the time we last synced:
      if (remoteTime > lastSyncTime + 1000) {
        throw new Error('CONFLICT_DETECTED');
      }
    } else {
       // If we've never synced from this device, but files exist, it's a conflict
       throw new Error('CONFLICT_DETECTED');
    }
  }

  // Generate backup content and compress
  const backupObject = await backupService.collectAllData();
  const backupDataString = JSON.stringify(backupObject);
  const { blob: contentBlob, compressed } = await backupService.compressData(backupDataString);

  // Delete older files if we exceed MAX_BACKUPS (keep MAX_BACKUPS - 1 as we are uploading a new one)
  if (files.length >= MAX_BACKUPS) {
    const filesToDelete = files.slice(MAX_BACKUPS - 1);
    for (const file of filesToDelete) {
      // BK9: cek hasil DELETE; bila gagal, jangan diam — file lama bisa menumpuk
      const delRes = await fetch(`${DRIVE_API_URL}/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!delRes.ok && delRes.status !== 404) {
        console.warn(`Gagal menghapus cadangan Drive lama (${file.id}): ${delRes.status}`, await delRes.text().catch(() => ''));
      }
    }
  }

  // Create new version. Ekstensi & mimeType mengikuti hasil kompresi (BK4): bila
  // kompresi gagal, simpan JSON mentah agar tetap bisa dipulihkan.
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = compressed ? `AetherScribe_Backup_${dateStr}.json.gz` : `AetherScribe_Backup_${dateStr}.json`;
  const contentType = compressed ? 'application/gzip' : 'application/json';

  const metadata = {
    name: fileName,
    mimeType: contentType,
    parents: [folderId],
  };

  const boundary = 'foo_bar_baz';

  const multipartBody = new Blob([
    `--${boundary}\r\n`,
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
    `${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\n`,
    `Content-Type: ${contentType}\r\n\r\n`,
    contentBlob,
    `\r\n--${boundary}--`
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadRes = await fetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: multipartBody,
  });

  if (!uploadRes.ok) {
     if (uploadRes.status === 401) throw new Error('TOKEN_EXPIRED');
     console.error('Failed to upload compressed backup', await uploadRes.text());
     return false;
  }

  // Update local record of last sync time to avoid conflicts on next sync
  localStorage.setItem('last_drive_sync_time', new Date().toISOString());

  return true;
}

