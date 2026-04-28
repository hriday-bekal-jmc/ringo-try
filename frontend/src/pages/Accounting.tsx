import React, { useMemo, useState, useRef } from 'react';
import {
  useSettlements,
  useSettlementDetail,
  useAttachReceipt,
  useMarkSettled,
  useTriggerExport,
  useExportStatus,
  Settlement,
} from '../hooks/useApplication';
import { uploadReceiptToDrive } from '../services/gdriveClient';
import Header from '../components/common/Header';

// React.memo + useMemo reserved for the data grid as per the design spec
const SettlementGrid = React.memo(function SettlementGrid({
  settlements,
  selectedId,
  onSelect,
}: {
  settlements: Settlement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const grandTotal = useMemo(
    () => settlements.reduce((sum, row) => sum + (Number(row.actual_amount) || Number(row.expected_amount) || 0), 0),
    [settlements]
  );

  return (
    <div>
      <div className="mb-3 text-sm text-gray-600 font-medium">
        合計金額: <span className="text-lg font-bold text-gray-900">¥{grandTotal.toLocaleString('ja-JP')}</span>
        <span className="ml-2 text-gray-400">({settlements.length}件)</span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm divide-y divide-gray-100">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">申請番号</th>
              <th className="px-4 py-3 text-left">申請者</th>
              <th className="px-4 py-3 text-left">テンプレート</th>
              <th className="px-4 py-3 text-right">予定金額</th>
              <th className="px-4 py-3 text-right">実費金額</th>
              <th className="px-4 py-3 text-left">状態</th>
              <th className="px-4 py-3 text-left">精算日</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {settlements.map((row) => (
              <tr
                key={row.id}
                className={`hover:bg-gray-50 transition-colors ${selectedId === row.id ? 'bg-brand-50' : ''}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.application_number}</td>
                <td className="px-4 py-3 text-gray-800">{row.applicant_name}</td>
                <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{row.template_title}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  ¥{Number(row.expected_amount).toLocaleString('ja-JP')}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {row.actual_amount != null ? `¥${Number(row.actual_amount).toLocaleString('ja-JP')}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {row.settled_at ? new Date(row.settled_at).toLocaleDateString('ja-JP') : '—'}
                </td>
                <td className="px-4 py-3">
                  {row.status !== 'PROCESSED' && (
                    <button
                      onClick={() => onSelect(row.id)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      処理
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
    PROCESSING:           'bg-blue-100 text-blue-800',
    PROCESSED:            'bg-green-100 text-green-800',
    DISPUTED:             'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function SettlementDetailPanel({
  settlementId,
  onClose,
}: {
  settlementId: string;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useSettlementDetail(settlementId);
  const attachReceipt = useAttachReceipt();
  const markSettled = useMarkSettled();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Receipt form state
  const [receiptDate, setReceiptDate] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [vendorName, setVendorName] = useState('');

  async function handleFileUpload(file: File) {
    setIsUploading(true);
    setUploadError('');
    setUploadProgress(0);
    try {
      const driveFileId = await uploadReceiptToDrive(file, (pct) => setUploadProgress(pct));

      await attachReceipt.mutateAsync({
        settlementId,
        receiptAmount: parseFloat(receiptAmount),
        receiptDate,
        vendorName: vendorName || undefined,
        driveFileId,
      });

      // Reset form
      setReceiptDate('');
      setReceiptAmount('');
      setVendorName('');
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError('領収書のアップロードに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmitReceipt() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError('ファイルを選択してください。');
      return;
    }
    if (!receiptDate || !receiptAmount) {
      setUploadError('日付と金額を入力してください。');
      return;
    }
    await handleFileUpload(file);
  }

  async function handleMarkSettled() {
    if (!confirm('この精算を完了としてマークしますか？この操作は取り消せません。')) return;
    try {
      await markSettled.mutateAsync(settlementId);
      onClose();
    } catch {
      alert('精算の完了処理に失敗しました。');
    }
  }

  if (isLoading) {
    return (
      <div className="mt-6 p-6 bg-white border rounded-xl">
        <p className="text-sm text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!detail) return null;

  const isProcessed = detail.status === 'PROCESSED';

  return (
    <div className="mt-6 bg-white border border-warm-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100 bg-warm-50">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {detail.application_number} — {detail.template_title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">申請者: {detail.applicant_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={detail.status} />
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕ 閉じる</button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Amount summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-warm-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">予定金額</p>
            <p className="text-base font-bold text-gray-700">¥{Number(detail.expected_amount).toLocaleString('ja-JP')}</p>
          </div>
          <div className="bg-warm-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">実費合計</p>
            <p className="text-base font-bold text-gray-900">
              {detail.actual_amount != null ? `¥${Number(detail.actual_amount).toLocaleString('ja-JP')}` : '—'}
            </p>
          </div>
          <div className="bg-warm-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">領収書</p>
            <p className="text-base font-bold text-gray-700">{detail.receipts.length}件</p>
          </div>
        </div>

        {/* Receipts list */}
        {detail.receipts.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">添付領収書</p>
            <div className="divide-y divide-warm-100 border border-warm-200 rounded-lg overflow-hidden">
              {detail.receipts.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-mono text-xs text-gray-400 mr-3">{r.receipt_number}</span>
                    <span className="text-gray-700">{r.vendor_name ?? '—'}</span>
                    <span className="ml-2 text-xs text-gray-400">{r.receipt_date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">
                      ¥{Number(r.receipt_amount).toLocaleString('ja-JP')}
                    </span>
                    <a
                      href={`https://drive.google.com/file/d/${r.drive_file_id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Drive
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add receipt form */}
        {!isProcessed && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">領収書を追加</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">日付</label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">金額 (円)</label>
                <input
                  type="number"
                  min="0"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  className="w-full border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">業者名 (任意)</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                  placeholder="株式会社..."
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-warm-300 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-warm-50"
              />
              <button
                onClick={handleSubmitReceipt}
                disabled={isUploading || attachReceipt.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
              >
                {isUploading ? `アップロード中 ${uploadProgress}%` : '領収書を添付'}
              </button>
            </div>

            {uploadError && (
              <p className="mt-2 text-xs text-red-600">{uploadError}</p>
            )}

            {isUploading && (
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-brand-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Mark settled */}
        {!isProcessed && (
          <div className="pt-2 border-t border-warm-100">
            <button
              onClick={handleMarkSettled}
              disabled={markSettled.isPending}
              className="px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {markSettled.isPending ? '処理中...' : '精算完了としてマーク'}
            </button>
            <p className="text-xs text-gray-400 mt-1.5">精算完了後は変更できません。</p>
          </div>
        )}

        {isProcessed && detail.settled_at && (
          <div className="pt-2 border-t border-warm-100">
            <p className="text-xs text-green-700 font-medium">
              ✓ 精算完了 — {new Date(detail.settled_at).toLocaleDateString('ja-JP')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Accounting() {
  const { data: settlements, isLoading } = useSettlements();
  const exportMutation = useTriggerExport();
  const { data: exportStatus } = useExportStatus();
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }

  return (
    <div>
      <Header
        title="経理・精算管理"
        subtitle="精算処理および領収書の確認を行います"
        action={
          <div className="flex items-center gap-3">
            {exportStatus?.ready && (
              <a
                href={`/api/settlements/export/download?file=${exportStatus.fileName}`}
                className="text-xs text-green-600 underline"
              >
                CSVダウンロード ({exportStatus.rows}件)
              </a>
            )}
            <button
              onClick={() => exportMutation.mutate({})}
              disabled={exportMutation.isPending}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {exportMutation.isPending ? 'エクスポート中...' : 'CSVエクスポート'}
            </button>
          </div>
        }
      />

      {exportMutation.isSuccess && !exportStatus?.ready && (
        <div className="mb-4 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded px-4 py-2">
          エクスポートを開始しました。完了次第ダウンロードリンクが表示されます。
        </div>
      )}

      {settlements && settlements.length > 0 ? (
        <SettlementGrid
          settlements={settlements}
          selectedId={selectedSettlementId}
          onSelect={(id) => setSelectedSettlementId(id === selectedSettlementId ? null : id)}
        />
      ) : (
        <p className="text-gray-500 text-sm">精算待ちの申請はありません。</p>
      )}

      {selectedSettlementId && (
        <SettlementDetailPanel
          settlementId={selectedSettlementId}
          onClose={() => setSelectedSettlementId(null)}
        />
      )}
    </div>
  );
}
