import { useRef, useState, DragEvent } from 'react';
import { uploadApplicationFile } from '../../services/gdriveClient';

interface UploadedFile {
  driveId: string;
  name: string;
  size: string;
}

interface Props {
  label: string;
  required?: boolean;
  multiple?: boolean;
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400 flex-shrink-0">
      <path d="M13 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z"/>
      <polyline points="13 2 13 7 18 7"/>
    </svg>
  );
}

export default function FileUploadField({ label, required, multiple, value, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  async function handleFiles(fileList: FileList) {
    const allowed = multiple ? Array.from(fileList) : [fileList[0]];
    if (!allowed.length) return;

    setUploadError('');
    const newUploading = allowed.map((f) => ({ name: f.name, progress: 0 }));
    setUploading((prev) => [...prev, ...newUploading]);

    const results = await Promise.allSettled(
      allowed.map(async (file, i) => {
        const driveId = await uploadApplicationFile(file, (pct) => {
          setUploading((prev) =>
            prev.map((u, idx) => (idx === prev.length - allowed.length + i ? { ...u, progress: pct } : u))
          );
        });
        return { driveId, name: file.name, size: formatSize(file.size) };
      })
    );

    const succeeded: UploadedFile[] = [];
    let hadError = false;
    results.forEach((r) => {
      if (r.status === 'fulfilled') succeeded.push(r.value);
      else hadError = true;
    });

    if (hadError) setUploadError('一部のファイルのアップロードに失敗しました。');

    const newIds = succeeded.map((f) => f.driveId);
    if (multiple) {
      setFiles((prev) => [...prev, ...succeeded]);
      onChange([...value, ...newIds]);
    } else {
      setFiles(succeeded.slice(0, 1));
      onChange(newIds.slice(0, 1));
    }

    setUploading((prev) => prev.slice(0, prev.length - allowed.length));
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(driveId: string) {
    setFiles((prev) => prev.filter((f) => f.driveId !== driveId));
    onChange(value.filter((id) => id !== driveId));
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  const canAddMore = multiple || files.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-1.5 mb-1">
          {files.map((f) => (
            <div
              key={f.driveId}
              className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            >
              <FileIcon />
              <span className="flex-1 truncate text-gray-700 font-medium">{f.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{f.size}</span>
              <a
                href={`https://drive.google.com/file/d/${f.driveId}/view`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-600 hover:underline flex-shrink-0"
              >
                表示
              </a>
              <button
                type="button"
                onClick={() => removeFile(f.driveId)}
                className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
                aria-label="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading.map((u, i) => (
        <div key={i} className="px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-brand-700 truncate">{u.name}</span>
            <span className="text-xs text-brand-500 ml-2 flex-shrink-0">{u.progress}%</span>
          </div>
          <div className="w-full bg-brand-200 rounded-full h-1">
            <div
              className="bg-brand-600 h-1 rounded-full transition-all"
              style={{ width: `${u.progress}%` }}
            />
          </div>
        </div>
      ))}

      {/* Drop zone */}
      {canAddMore && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border-2 border-dashed text-sm transition-colors cursor-pointer ${
            isDragging
              ? 'border-brand-400 bg-brand-50 text-brand-600'
              : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50 text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M4 16s-1-0.5-1-2V6a2 2 0 0 1 2-2h2l2-2h2l2 2h2a2 2 0 0 1 2 2v8c0 1.5-1 2-1 2H4z"/>
            <polyline points="10 8 10 14"/>
            <polyline points="7 11 10 8 13 11"/>
          </svg>
          <span>
            {isDragging
              ? 'ドロップしてアップロード'
              : `ファイルを選択${multiple ? '（複数可）' : ''}`}
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple={multiple}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </button>
      )}

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      {error && <p className="text-xs text-red-500">必須項目です</p>}
    </div>
  );
}
