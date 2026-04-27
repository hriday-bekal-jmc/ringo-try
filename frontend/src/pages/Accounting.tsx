import React, { useMemo, useState } from 'react';
import { useSettlements, useTriggerExport, useExportStatus, Settlement } from '../hooks/useApplication';
import Header from '../components/common/Header';

// React.memo + useMemo reserved for the data grid as per the design spec
const SettlementGrid = React.memo(function SettlementGrid({
  settlements,
  onSelect,
}: {
  settlements: Settlement[];
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
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
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
                  <button
                    onClick={() => onSelect(row.id)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    処理
                  </button>
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
          onSelect={(id) => setSelectedSettlementId(id)}
        />
      ) : (
        <p className="text-gray-500 text-sm">精算待ちの申請はありません。</p>
      )}

      {selectedSettlementId && (
        <div className="mt-6 p-4 bg-white border rounded-xl">
          <p className="text-sm text-gray-600">
            Settlement ID: <code className="font-mono text-xs">{selectedSettlementId}</code>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            精算詳細画面は次フェーズで実装予定です。
          </p>
          <button
            onClick={() => setSelectedSettlementId(null)}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}
