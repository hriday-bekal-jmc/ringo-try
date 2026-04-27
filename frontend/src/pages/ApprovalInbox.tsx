import { useState } from 'react';
import { useApprovalInbox, useApproveAction, useApplication } from '../hooks/useApplication';
import Modal from '../components/common/Modal';
import ApprovalTimeline from '../components/workflow/ApprovalTimeline';
import Header from '../components/common/Header';

const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED:         'bg-green-100 text-green-800',
  REJECTED:         'bg-red-100 text-red-800',
  RETURNED:         'bg-orange-100 text-orange-800',
};

export default function ApprovalInbox() {
  const { data: items, isLoading } = useApprovalInbox();
  const actionMutation = useApproveAction();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
  const [comment, setComment] = useState('');

  const { data: detail } = useApplication(selectedId ?? '');

  async function handleAction() {
    if (!selectedId || !actionType) return;
    if ((actionType === 'REJECT' || actionType === 'RETURN') && !comment.trim()) {
      alert('却下・差戻し時はコメントが必須です。');
      return;
    }

    await actionMutation.mutateAsync({
      applicationId: selectedId,
      action: actionType,
      comment: comment.trim() || undefined,
    });

    setSelectedId(null);
    setActionType(null);
    setComment('');
  }

  if (isLoading) {
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }

  return (
    <div>
      <Header
        title="承認受信箱"
        subtitle={`${items?.length ?? 0}件 承認待ち`}
      />

      {items?.length === 0 && (
        <p className="text-gray-500 text-sm">承認待ちの申請はありません。</p>
      )}

      <div className="space-y-3">
        {items?.map((item) => (
          <div
            key={item.id}
            className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-gray-400">{item.application_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{item.template_title}</p>
              <p className="text-xs text-gray-400">
                申請者: {item.applicant_name} · {new Date(item.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>

            <button
              onClick={() => setSelectedId(item.id)}
              className="flex-shrink-0 px-4 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 transition-colors"
            >
              審査する
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={!!selectedId && !actionType}
        onClose={() => setSelectedId(null)}
        title={`申請 ${detail?.application_number ?? ''} — 審査`}
      >
        {detail && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded p-3 text-sm">
              <p className="font-semibold mb-2">{detail.template_title}</p>
              {Object.entries(detail.form_data).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs py-1 border-b last:border-0">
                  <span className="text-gray-500 w-32 flex-shrink-0">{k}</span>
                  <span className="text-gray-800">{String(v)}</span>
                </div>
              ))}
            </div>

            {detail.steps && (
              <ApprovalTimeline steps={detail.steps} applicationStatus={detail.status} />
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setActionType('APPROVE')}
                className="flex-1 bg-green-600 text-white py-2 rounded text-sm hover:bg-green-700"
              >
                承認
              </button>
              <button
                onClick={() => setActionType('RETURN')}
                className="flex-1 bg-orange-500 text-white py-2 rounded text-sm hover:bg-orange-600"
              >
                差戻し
              </button>
              <button
                onClick={() => setActionType('REJECT')}
                className="flex-1 bg-red-600 text-white py-2 rounded text-sm hover:bg-red-700"
              >
                却下
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!actionType}
        onClose={() => setActionType(null)}
        title={actionType === 'APPROVE' ? '承認の確認' : actionType === 'REJECT' ? '却下の確認' : '差戻しの確認'}
      >
        <div className="space-y-4">
          {actionType !== 'APPROVE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                コメント (必須)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="理由を入力してください..."
                className="w-full border rounded px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setActionType(null)} className="flex-1 border rounded py-2 text-sm">
              キャンセル
            </button>
            <button
              onClick={handleAction}
              disabled={actionMutation.isPending}
              className="flex-1 bg-brand-600 text-white py-2 rounded text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {actionMutation.isPending ? '処理中...' : '確定'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
