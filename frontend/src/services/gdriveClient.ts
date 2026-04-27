import apiClient from './apiClient';

/**
 * Requests a Google Drive resumable upload URL from the backend,
 * then uploads the file directly to Google Drive.
 * The Node.js server never handles the physical file bytes.
 */
export async function uploadReceiptToDrive(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  // 1. Get a pre-signed upload URL from our backend
  const { data } = await apiClient.post<{ uploadUrl: string }>('/api/settlements/upload-url', {
    fileName: file.name,
    mimeType: file.type,
  });

  // 2. Upload directly to Google Drive with progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Extract the Drive file ID from the response
        try {
          const responseData = JSON.parse(xhr.responseText) as { id?: string };
          resolve(responseData.id ?? '');
        } catch {
          resolve('');
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(file);
  });
}
