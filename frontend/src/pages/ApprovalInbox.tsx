import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  useApprovalInbox,
  useApprovalHistory,
  useWaitingApprovals,
  useApproveAction,
  useApplication,
  InboxItem,
} from '../hooks/useApplication';
import Modal from '../components/common/Modal';
import ApprovalTimeline from '../components/workflow/ApprovalTimeline';
import Header from '../components/common/Header';

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:  { label: '承認待ち', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '承認済み', color: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: '却下',     color: 'bg-red-100 text-red-800' },
  RETURNED: { label: '差戻し',   color: 'bg-orange-100 text-orange-800' },
  WAITING:  { label: '待機中',   color: 'bg-gray-100 text-gray-600' },
};

// ── Category definitions ──────────────────────────────────────────────────────

type CategoryKey = 'shonin' | 'sagyo' | 'kakunin' | 'sashimodoshi' | 'dairi';

interface Category {
  key: CategoryKey;
  label: string;
  emptyLabel: string;
  filter: (item: InboxItem) => boolean;
  iconPath: string | string[];
  tileColor: string;
  tileActiveBg: string;
  tileActiveBorder: string;
  iconActiveBg: string;
  iconActiveColor: string;
  barColor: string;
}

const CATEGORIES: Category[] = [
  {
    key: 'shonin',
    label: '承認',
    emptyLabel: '承認待ちの申請はありません。',
    filter: (item) => item.step_status === 'PENDING',
    iconPath: 'M5 13l4 4L19 7',
    tileColor: 'text-brand-700',
    tileActiveBg: 'bg-brand-50',
    tileActiveBorder: 'border-brand-400',
    iconActiveBg: 'bg-brand-100',
    iconActiveColor: 'text-brand-600',
    barColor: 'bg-brand-600',
  },
  {
    key: 'sagyo',
    label: '作業',
    emptyLabel: '作業項目はありません。',
    filter: () => false,
    iconPath: [
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
      'M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      'M9 12h6M9 16h4',
    ],
    tileColor: 'text-blue-700',
    tileActiveBg: 'bg-blue-50',
    tileActiveBorder: 'border-blue-400',
    iconActiveBg: 'bg-blue-100',
    iconActiveColor: 'text-blue-600',
    barColor: 'bg-blue-500',
  },
  {
    key: 'kakunin',
    label: '確認',
    emptyLabel: '確認待ちの申請はありません。',
    filter: () => false,
    iconPath: [
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    ],
    tileColor: 'text-purple-700',
    tileActiveBg: 'bg-purple-50',
    tileActiveBorder: 'border-purple-400',
    iconActiveBg: 'bg-purple-100',
    iconActiveColor: 'text-purple-600',
    barColor: 'bg-purple-500',
  },
  {
    key: 'sashimodoshi',
    label: '差し戻し',
    emptyLabel: '差し戻し済みの申請はありません。',
    filter: (item) => item.step_status === 'RETURNED',
    iconPath: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
    tileColor: 'text-orange-700',
    tileActiveBg: 'bg-orange-50',
    tileActiveBorder: 'border-orange-400',
    iconActiveBg: 'bg-orange-100',
    iconActiveColor: 'text-orange-600',
    barColor: 'bg-orange-500',
  },
  {
    key: 'dairi',
    label: '代理承認',
    emptyLabel: '代理承認の申請はありません。',
    filter: () => false,
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    tileColor: 'text-gray-600',
    tileActiveBg: 'bg-gray-50',
    tileActiveBorder: 'border-gray-400',
    iconActiveBg: 'bg-gray-200',
    iconActiveColor: 'text-gray-600',
    barColor: 'bg-gray-400',
  },
];

// ── Icon helper ───────────────────────────────────────────────────────────────

function CatIcon({ paths, className }: { paths: string | string[]; className: string }) {
  const arr = Array.isArray(paths) ? paths : [paths];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      {arr.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// ── Read-only field list for modal ────────────────────────────────────────────

function FieldList({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-0 divide-y divide-warm-100">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex gap-3 py-2 text-sm">
          <span className="text-gray-400 w-32 flex-shrink-0 text-xs pt-0.5">{k}</span>
          <span className="text-gray-800 font-medium">{String(v ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Simple list for history / waiting views ───────────────────────────────────

function SimpleItemList({ items, emptyText }: { items: InboxItem[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-warm-200 py-16 text-center text-sm text-gray-400">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const cfg = STEP_STATUS_CONFIG[item.step_status] ?? { label: item.step_status, color: 'bg-gray-100 text-gray-500' };
        return (
          <Link
            key={`${item.id}-${item.step_order}`}
            to={`/applications/${item.id}`}
            className="bg-white border border-warm-200 rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-all block"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-gray-400">{item.application_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-gray-300">ステップ {item.step_order}</span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{item.template_title}</p>
              <p className="text-xs text-gray-400 mt-0.5">申請者: {item.applicant_name}</p>
            </div>
            <span className="text-xs text-brand-600 flex-shrink-0">詳細 →</span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ApprovalInbox() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view'); // 'all' | 'waiting' | null (default = inbox)

  const { data: inboxItems, isLoading: inboxLoading } = useApprovalInbox();
  const { data: historyItems, isLoading: historyLoading } = useApprovalHistory();
  const { data: waitingItems, isLoading: waitingLoading } = useWaitingApprovals();

  const actionMutation = useApproveAction();

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('shonin');
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
  const [comment, setComment] = useState('');

  const { data: detail } = useApplication(selectedItem?.id ?? '');

  const items = inboxItems;
  const pendingCount = items?.filter((i) => i.step_status === 'PENDING').length ?? 0;

  const activeCat = CATEGORIES.find((c) => c.key === selectedCategory)!;
  const displayedItems = items?.filter(activeCat.filter) ?? [];

  async function handleAction() {
    if (!selectedItem || !actionType) return;
    if ((actionType === 'REJECT' || actionType === 'RETURN') && !comment.trim()) {
      alert('却下・差戻し時はコメントが必須です。');
      return;
    }

    await actionMutation.mutateAsync({
      applicationId: selectedItem.id,
      action: actionType,
      comment: comment.trim() || undefined,
    });

    setSelectedItem(null);
    setActionType(null);
    setComment('');
  }

  // ── 全ての承認 view ──
  if (view === 'all') {
    return (
      <div className="max-w-4xl mx-auto">
        <Header title="全ての承認" subtitle={`${historyItems?.length ?? 0}件`} />
        {historyLoading
          ? <div className="text-gray-400 py-12 text-center">読み込み中...</div>
          : <SimpleItemList items={historyItems ?? []} emptyText="承認履歴はまだありません。" />
        }
      </div>
    );
  }

  // ── 作業予定 view ──
  if (view === 'waiting') {
    return (
      <div className="max-w-4xl mx-auto">
        <Header title="作業予定" subtitle="承認チェーンの後続ステップ（現在待機中）" />
        {waitingLoading
          ? <div className="text-gray-400 py-12 text-center">読み込み中...</div>
          : <SimpleItemList items={waitingItems ?? []} emptyText="作業予定はありません。" />
        }
      </div>
    );
  }

  if (inboxLoading) {
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Header
        title="承認予定"
        subtitle={`${pendingCount}件 承認待ち`}
      />

      {/* ── 未処理 category tiles ── */}
      <div className="mb-7">
        <h2 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gray-300 inline-block" />
          未処理
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => {
            const count = items?.filter(cat.filter).length ?? 0;
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-xl border-2 p-4 text-center transition-all focus:outline-none group ${
                  isActive
                    ? `${cat.tileActiveBg} ${cat.tileActiveBorder}`
                    : 'bg-white border-warm-200 hover:border-warm-300 hover:bg-warm-50/60'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2.5 transition-colors ${
                  isActive ? cat.iconActiveBg : 'bg-warm-100 group-hover:bg-warm-200'
                }`}>
                  <CatIcon
                    paths={cat.iconPath}
                    className={`w-5 h-5 transition-colors ${isActive ? cat.iconActiveColor : 'text-gray-400'}`}
                  />
                </div>
                <div className={`text-xs font-semibold leading-tight transition-colors ${
                  isActive ? cat.tileColor : 'text-gray-500'
                }`}>
                  {cat.label}
                </div>
                <div className={`text-2xl font-bold mt-1 leading-none transition-colors ${
                  count > 0
                    ? isActive ? cat.tileColor : 'text-gray-700'
                    : 'text-gray-200'
                }`}>
                  {count}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Application list for selected category ── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className={`w-1 h-4 rounded-full inline-block ${activeCat.barColor}`} />
          {activeCat.label}
          <span className="font-normal">({displayedItems.length}件)</span>
        </h2>

        {displayedItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-warm-200 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-warm-100 flex items-center justify-center mx-auto mb-3">
              <CatIcon paths={activeCat.iconPath} className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">{activeCat.emptyLabel}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedItems.map((item) => {
              const isReturned = item.step_status === 'RETURNED';
              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-4 flex items-center justify-between gap-4 transition-all hover:shadow-sm ${
                    isReturned ? 'border-orange-200' : 'border-warm-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-400">{item.application_number}</span>
                      {isReturned && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
                          差し戻し済み
                        </span>
                      )}
                      <span className="text-xs text-gray-300">ステップ {item.step_order}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{item.template_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      申請者: {item.applicant_name} · {new Date(item.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedItem(item)}
                    className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                      isReturned
                        ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {isReturned ? '確認する' : '審査する'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      <Modal
        open={!!selectedItem && !actionType}
        onClose={() => setSelectedItem(null)}
        title={`申請 ${detail?.application_number ?? ''} — 審査`}
      >
        {detail && (
          <div className="space-y-4">
            <div className="bg-warm-50 rounded-xl border border-warm-200 p-4">
              <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">{detail.template_title}</p>
              <FieldList data={detail.form_data} />
            </div>

            {detail.steps && detail.steps.length > 0 && (
              <div className="border border-warm-200 rounded-xl p-4">
                <ApprovalTimeline steps={detail.steps} applicationStatus={detail.status} />
              </div>
            )}

            {selectedItem?.step_status === 'RETURNED' ? (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                この申請は差し戻し済みです。申請者が内容を修正して再提出するまでお待ちください。
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setActionType('APPROVE')}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                >
                  承認
                </button>
                <button
                  onClick={() => setActionType('RETURN')}
                  className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors"
                >
                  差戻し
                </button>
                <button
                  onClick={() => setActionType('REJECT')}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  却下
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Confirm action modal ── */}
      <Modal
        open={!!actionType}
        onClose={() => setActionType(null)}
        title={
          actionType === 'APPROVE' ? '承認の確認'
          : actionType === 'REJECT' ? '却下の確認'
          : '差戻しの確認'
        }
      >
        <div className="space-y-4">
          {actionType !== 'APPROVE' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                コメント <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="理由を入力してください..."
                className="w-full border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
              />
            </div>
          )}
          {actionType === 'APPROVE' && (
            <p className="text-sm text-gray-600">
              この申請を承認します。よろしいですか？
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setActionType(null)}
              className="flex-1 border border-warm-300 rounded-lg py-2.5 text-sm text-gray-600 hover:bg-warm-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleAction}
              disabled={actionMutation.isPending}
              className={`flex-1 text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors ${
                actionType === 'APPROVE'
                  ? 'bg-green-600 hover:bg-green-700'
                  : actionType === 'RETURN'
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {actionMutation.isPending ? '処理中...' : '確定'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
