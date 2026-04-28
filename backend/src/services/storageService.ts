import { getDriveClient } from '../config/gdrive';

export const StorageService = {
  /**
   * Generates a Google Drive resumable upload URL.
   * The React frontend uploads the file directly to Google Drive
   * using this URL — the Node.js server never handles the physical bytes.
   * After upload, the frontend receives the Drive file ID to store in DB.
   */
  async generateUploadUrl(
    fileName: string,
    mimeType: string,
    folderId?: string
  ): Promise<string> {
    const drive = getDriveClient();
    const targetFolderId = folderId ?? process.env.GDRIVE_FOLDER_ID ?? '';

    const res = await (drive.files.create as Function)(
      {
        requestBody: {
          name: fileName,
          parents: targetFolderId ? [targetFolderId] : undefined,
        },
        media: { mimeType },
        uploadType: 'resumable',
        fields: 'id',
      },
      { onUploadProgress: () => {} }
    ) as { config?: { url?: string } };

    return res.config?.url ?? '';
  },

  /** Deletes a file from Google Drive by its file ID. */
  async deleteFile(fileId: string): Promise<void> {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
  },

  /** Returns a permanent shareable URL for a Drive file. */
  buildFileUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
  },
};
