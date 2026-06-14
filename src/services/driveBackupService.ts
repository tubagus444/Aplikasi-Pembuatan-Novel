import { getAccessToken } from './googleAuth';
import { db } from '../db';
import { backupService } from './backupService';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

const FOLDER_NAME = 'AetherScribe Backups';

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

// Upload a single project backup
export async function syncProjectToDrive(): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  const folderId = await getAppFolder(accessToken);
  if (!folderId) return false;

  // Generate backup content
  const backupObject = await backupService.collectAllData();
  const backupData = JSON.stringify(backupObject);

  const fileName = `AetherScribe_FullBackup.json`;

  const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const searchRes = await fetch(`${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  const searchData = await searchRes.json();
  const existingFileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    ...(existingFileId ? {} : { parents: [folderId] }), 
  };

  const boundary = 'foo_bar_baz';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    backupData +
    close_delim;

  const url = existingFileId 
    ? `${UPLOAD_API_URL}/${existingFileId}?uploadType=multipart`
    : `${UPLOAD_API_URL}?uploadType=multipart`;

  const method = existingFileId ? 'PATCH' : 'POST';

  const uploadRes = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!uploadRes.ok) {
     console.error('Failed to upload backup', await uploadRes.text());
     return false;
  }

  return true;
}

