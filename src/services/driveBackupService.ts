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
     console.error('Failed to create app folder', await createRes.text());
     return null;
  }

  const createData = await createRes.json();
  return createData.id;
}

// Compress string data to gzip Blob
async function compressData(dataString: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const stream = new Blob([data]).stream();
  // @ts-ignore - CompressionStream is available in modern browsers but TypeScript might be strict
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  return await new Response(compressedStream).blob();
}

// Upload a single project backup with Versioning and Compression
export async function syncProjectToDrive(): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  const folderId = await getAppFolder(accessToken);
  if (!folderId) return false;

  // Generate backup content and compress
  const backupObject = await backupService.collectAllData();
  const backupDataString = JSON.stringify(backupObject);
  const compressedBlob = await compressData(backupDataString);

  // File Versioning: Find existing files to rotate
  const listQuery = `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const listRes = await fetch(`${DRIVE_API_URL}?q=${encodeURIComponent(listQuery)}&orderBy=createdTime desc&fields=files(id,name,createdTime)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const listData = await listRes.json();
  const files = listData.files || [];

  // Delete older files if we exceed MAX_BACKUPS (keep MAX_BACKUPS - 1 as we are uploading a new one)
  if (files.length >= MAX_BACKUPS) {
    const filesToDelete = files.slice(MAX_BACKUPS - 1);
    for (const file of filesToDelete) {
      await fetch(`${DRIVE_API_URL}/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    }
  }

  // Create new version
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `AetherScribe_Backup_${dateStr}.json.gz`;

  const metadata = {
    name: fileName,
    mimeType: 'application/gzip',
    parents: [folderId], 
  };

  const boundary = 'foo_bar_baz';
  
  const multipartBody = new Blob([
    `--${boundary}\r\n`,
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
    `${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\n`,
    `Content-Type: application/gzip\r\n\r\n`,
    compressedBlob,
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
     console.error('Failed to upload compressed backup', await uploadRes.text());
     return false;
  }

  return true;
}

