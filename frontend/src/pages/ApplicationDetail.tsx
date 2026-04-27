import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useApplication,
  useResubmit,
  useUpdateApplication,
  useSubmitDraft,
  useApprovers,
  Approver,
} from '../hooks/useApplication';
import ApprovalTimeline from '../components/workflow/ApprovalTimeline';
import DynamicForm from '../components/forms/DynamicForm';
import Modal from '../components/common/Modal';
import Header from '../components/common/Header';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:              { label: '下書き',      color: 'bg-gray-100 text-gray-600' },
  PENDING_APPROVAL:   { label: '承認待ち',    color: 'bg-yellow-100 text-yellow-800' },
  APPROVED:           { label: '承認済み',    color: 'bg-green-100 text-green-800' },
  REJECTED:           { label: '却下',        color: 'bg-red-100 text-red-800' },
  RETURNED:           { label: '差戻し',      color: 'bg-orange-100 text-orange-800' },
  PENDING_SETTLEMENT: { label: '精算待ち',    color: 'bg-blue-100 text-blue-800' },
  SETTLED:            { label: '精算完了',    color: 'bg-green-100 text-green-700' },
};

// ── Read-only field list ───────────────────────────────────────────────────────

function FieldList({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="space-y-3">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex gap-4 text-sm border-b border-warm-100 pb-2.5 last:border-0">
          <dt className="text-gray-400 w-40 flex-shrink-0">{k}</dt>
          <dd className="text-gray-800 font-medium">{String(v ?? '—')}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: app, isLoading } = useApplication(id!);
  const resubmitMutation  = useResubmit();
  const updateMutation    = useUpdateApplication();
  const submitDraftMutation = useSubmitDraft();

  // Approver picker (used for both DRAFT submit and RETURNED resubmit where needed)
  const [approverPickerOpen, setApproverPickerOpen] = useState(false);
  const [approverSearch, setApproverSearch]         = useState('');
  const [selectedApprovers, setSelectedApprovers]   = useState<Approver[]>([]);
  const { data: approverResults } = useApprovers(approverSearch);

  // Pending form payload — held while user opens approver picker
  const [pendingPayload, setPendingPayload] = useState<{ form_data: Record<string, unknown>; version: number } | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [saveOk, setSaveOk]     = useState(false);

  if (isLoading) return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  if (!app)      return <div className="text-red-500 text-sm py-12 text-center">申請が見つかりませんでした。</div>;

  const cfg        = STATUS_CONFIG[app.status] ?? { label: app.status, color: 'bg-gray-100 text-gray-600' };
  const isDraft    = app.status === 'DRAFT';
  const isReturned = app.status === 'RETURNED';
  const returnComment = app.steps?.find((s) => s.status === 'RETURNED')?.comments;

  function toggleApprover(a: Approver) {
    setSelectedApprovers((prev) => prev.find((x) => x.id === a.id) ? prev.filter((x) => x.id !== a.id) : [...prev, a]);
  }

  // ── DRAFT: save draft changes (onSaveDraft receives just formData, we use app.version) ──

  async function handleSaveDraftUpdate(formData: Record<string, unknown>) {
    try {
      await updateMutation.mutateAsync({ id: id!, formData, version: app!.version });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch {
      alert('下書きの保存に失敗しました。');
    }
  }

  // ── DRAFT: "申請する" — collect payload then open picker ─────────────────

  function handleDraftSubmitClick(payload: { form_data: Record<string, unknown>; version: number }) {
    setPendingPayload(payload);
    setApproverPickerOpen(true);
  }

  // ── DRAFT: confirm approvers and submit ───────────────────────────────────

  async function confirmDraftSubmit() {
    if (!pendingPayload || selectedApprovers.length === 0) return;
    setApproverPickerOpen(false);
    try {
      await submitDraftMutation.mutateAsync({
        id: id!,
        approvers: selectedApprovers.map((a, i) => ({ approverId: a.id, stepOrder: i + 1 })),
        version: pendingPayload.version,
        formData: pendingPayload.form_data,
      });
      navigate('/applications');
    } catch {
      alert('申請の送信に失敗しました。もう一度お試しください。');
    }
  }

  // ── RETURNED: resubmit ────────────────────────────────────────────────────

  async function handleResubmit(payload: { form_data: Record<string, unknown>; version: number }) {
    try {
      await resubmitMutation.mutateAsync({ id: id!, formData: payload.form_data, version: payload.version });
      navigate('/applications');
    } catch {
      alert('再提出に失敗しました。もう一度お試しください。');
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Header
        title={app.template_title}
        subtitle={app.application_number}
        action={
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>
            <Link to="/applications" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← 一覧へ
            </Link>
          </div>
        }
      />

      {/* ── DRAFT mode ── */}
      {isDraft && (
        <div className="space-y-5">
          {/* Draft notice */}
          <div className="p-4 bg-warm-100 border border-warm-300 rounded-xl flex items-start gap-3">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/><path d="M18 2l-8 8-3 1 1-3 8-8z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-700">下書きを編集中</p>
              <p className="text-xs text-gray-500 mt-0.5">内容を修正して「下書き保存」、または承認者を選んで「申請する」を押してください。</p>
            </div>
            {saveOk && (
              <span className="ml-auto text-xs text-emerald-600 font-semibold flex items-center gap-1">
                ✓ 保存済み
              </span>
            )}
          </div>

          {/* Approver selection display */}
          {selectedApprovers.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs font-semibold text-blue-700 mb-2">承認フロー（申請時に適用）:</p>
              <div className="flex flex-wrap gap-2">
                {selectedApprovers.map((a, i) => (
                  <span key={a.id} className="text-xs bg-white border border-blue-200 rounded-full px-3 py-1 text-gray-700">
                    {i + 1}. {a.full_name} ({a.role})
                  </span>
                ))}
              </div>
              <button onClick={() => setApproverPickerOpen(true)} className="mt-2 text-xs text-blue-600 underline">
                変更する
              </button>
            </div>
          )}

          {/* Editable form */}
          <DynamicForm
            schemaDefinition={app.schema_definition}
            currentVersion={app.version}
            defaultValues={app.form_data}
            onSaveDraft={handleSaveDraftUpdate}
            isSavingDraft={updateMutation.isPending}
            onSubmit={handleDraftSubmitClick}
            isSubmitting={submitDraftMutation.isPending}
            submitLabel={selectedApprovers.length > 0 ? `申請する (${selectedApprovers.length}名)` : '承認者を選択して申請'}
          />
        </div>
      )}

      {/* ── Read-only view (non-draft, non-returned) ── */}
      {!isDraft && !isReturned && (
        <>
          {app.steps && app.steps.length > 0 && (
            <div className="mb-5 bg-white rounded-xl border border-warm-200 p-5">
              <ApprovalTimeline steps={app.steps} applicationStatus={app.status} />
            </div>
          )}
          <div className="bg-white rounded-xl border border-warm-200 p-5">
            <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-4">申請内容</h3>
            <FieldList data={app.form_data} />
          </div>
        </>
      )}

      {/* ── RETURNED: edit + resubmit ── */}
      {isReturned && app.schema_definition && (
        <div className="space-y-5">
          <div className="p-4 bg-orange-50 border border-orange-300 rounded-xl">
            <p className="text-sm font-semibold text-orange-800 mb-1">この申請は差戻されました。内容を修正して再提出してください。</p>
            {returnComment && (
              <p className="text-sm text-orange-700 bg-white rounded-lg p-3 border border-orange-200 mt-2">
                <span className="font-semibold">差戻しコメント: </span>{returnComment}
              </p>
            )}
          </div>

          {app.steps && app.steps.length > 0 && !editMode && (
            <div className="bg-white rounded-xl border border-warm-200 p-5">
              <ApprovalTimeline steps={app.steps} applicationStatus={app.status} />
            </div>
          )}

          {!editMode ? (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-warm-200 p-5">
                <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-4">現在の申請内容</h3>
                <FieldList data={app.form_data} />
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors"
              >
                内容を修正して再提出する
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">内容を修正してください</p>
                <button onClick={() => setEditMode(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                  キャンセル
                </button>
              </div>
              <DynamicForm
                schemaDefinition={app.schema_definition}
                currentVersion={app.version}
                defaultValues={app.form_data}
                onSubmit={handleResubmit}
                isSubmitting={resubmitMutation.isPending}
                submitLabel="再提出する"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Approver picker modal (used for DRAFT submit) ── */}
      <Modal open={approverPickerOpen} onClose={() => setApproverPickerOpen(false)} title="承認者を選択">
        <div className="space-y-3">
          <input
            type="text"
            placeholder="名前を検索 (2文字以上)..."
            value={approverSearch}
            onChange={(e) => setApproverSearch(e.target.value)}
            className="w-full border border-warm-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
          />
          <div className="max-h-60 overflow-y-auto divide-y divide-warm-100 rounded-lg border border-warm-200">
            {approverResults?.map((a) => {
              const sel = selectedApprovers.some((x) => x.id === a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleApprover(a)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-warm-50 transition-colors ${sel ? 'bg-brand-50' : ''}`}
                >
                  <div>
                    <span className="font-medium text-gray-800">{a.full_name}</span>
                    <span className="ml-2 text-xs text-gray-400">{a.role} · {a.department_name}</span>
                  </div>
                  {sel && <span className="text-brand-600 text-xs font-bold">✓ 選択済み</span>}
                </button>
              );
            })}
            {approverResults?.length === 0 && (
              <p className="py-5 text-center text-sm text-gray-400">該当者が見つかりません</p>
            )}
          </div>

          {selectedApprovers.length > 0 && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
              承認順: {selectedApprovers.map((a, i) => `${i + 1}. ${a.full_name}`).join(' → ')}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setApproverPickerOpen(false)}
              className="px-4 py-2 text-sm border border-warm-300 rounded-lg text-gray-600 hover:bg-warm-50"
            >
              キャンセル
            </button>
            <button
              onClick={confirmDraftSubmit}
              disabled={selectedApprovers.length === 0 || submitDraftMutation.isPending}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-semibold"
            >
              {submitDraftMutation.isPending ? '送信中...' : `申請する (${selectedApprovers.length}名)`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
