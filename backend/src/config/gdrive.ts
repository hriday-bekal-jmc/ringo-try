import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

function getAuth() {
  const keyPath = path.resolve(
    process.env.GDRIVE_SERVICE_ACCOUNT_PATH ?? './secrets/gdrive-service-account.json'
  );

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Google Drive service account key not found at ${keyPath}`);
  }

  return new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

export function getDriveClient() {
  const auth = getAuth();
  return google.drive({ version: 'v3', auth });
}

export { getAuth };
