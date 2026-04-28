import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useTemplate,
  useApprovers,
  useSubmitApplication,
  useSaveDraft,
  Approver,
} from '../hooks/useApplication';
import { recordTemplateVisit } from './Dashboard';
import DynamicForm from '../components/forms/DynamicForm';

// ── Approver chip ──────────────────────────────────────────────────────────────

function ApproverChip({ approver, index, onRemove }: { approver: Approver; index: number; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-warm-200 rounded-full pl-2.5 pr-1.5 py-1 text-sm shadow-sm">
      <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>
      <span className="text-gray-800 font-medium">{approver.full_name}</span>
      <span className="text-xs text-gray-400">{approver.role}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-gray-300 hover:text-red-400 transition-colors text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}

// ── Approver search panel ──────────────────────────────────────────────────────

function ApproverSearch({
  selectedApprovers,
  onToggle,
}: {
  selectedApprovers: Approver[];
  onToggle: (a: Approver) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const { data: results } = useApprovers(search);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="名前で検索 (2文字以上)..."
        className="w-full border border-warm-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors bg-white"
      />

      {open && results && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-warm-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((a) => {
            const selected = selectedApprovers.some((s) => s.id === a.id);
            return (
              <button
                key={a.id}
                type="button"
                onMouseDown={() => onToggle(a)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-warm-50 transition-colors ${selected ? 'bg-brand-50' : ''}`}
              >
                <div>
                  <span className="font-medium text-gray-800">{a.full_name}</span>
                  <span className="ml-2 text-xs text-gray-400">{a.role} · {a.department_name}</span>
                </div>
                {selected && <span className="text-brand-600 text-xs font-bold">✓ 選択済み</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Application() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useTemplate(templateId!);

  useEffect(() => {
    if (templateId) recordTemplateVisit(templateId);
  }, [templateId]);

  const submitMutation = useSubmitApplication();
  const saveDraftMutation = useSaveDraft();
  const [selectedApprovers, setSelectedApprovers] = useState<Approver[]>([]);
  const [approverError, setApproverError] = useState('');

  function toggleApprover(a: Approver) {
    setApproverError('');
    setSelectedApprovers((prev) =>
      prev.find((x) => x.id === a.id) ? prev.filter((x) => x.id !== a.id) : [...prev, a]
    );
  }

  async function handleSubmit(payload: { form_data: Record<string, unknown>; version: number }) {
    if (selectedApprovers.length === 0) {
      setApproverError('承認者を1名以上選択してください。');
      return;
    }
    try {
      const result = await submitMutation.mutateAsync({
        templateId: template!.id,
        formData: payload.form_data,
        approvers: selectedApprovers.map((a, i) => ({ approverId: a.id, stepOrder: i + 1 })),
      });
      navigate(`/applications/${result.id}`);
    } catch {
      alert('申請の送信に失敗しました。もう一度お試しください。');
    }
  }

  async function handleSaveDraft(formData: Record<string, unknown>) {
    try {
      const result = await saveDraftMutation.mutateAsync({ templateId: template!.id, formData });
      navigate(`/applications/${result.id}`);
    } catch {
      alert('下書きの保存に失敗しました。');
    }
  }

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
          <span className="text-sm">フォームを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* ── Breadcrumb ── */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link to="/" className="hover:text-gray-600 transition-colors">ダッシュボード</Link>
        <span>/</span>
        <span className="text-gray-600 font-medium">{template.title}</span>
      </div>

      {/* ── Form card ── */}
      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden shadow-sm">
        {/* Card header */}
        <div className="px-8 py-6 border-b border-warm-100">
          <p className="text-xs text-brand-600 font-semibold uppercase tracking-widest mb-1">
            {template.title_en}
          </p>
          <h1 className="text-xl font-bold text-gray-900">{template.title}</h1>
        </div>

        {/* ── Approver section ── */}
        <div className="px-8 py-6 border-b border-warm-100 bg-warm-50/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">承認フロー</h2>
              <p className="text-xs text-gray-400 mt-0.5">承認者を順番に選択してください</p>
            </div>
            {selectedApprovers.length > 0 && (
              <span className="text-xs text-brand-600 font-medium bg-brand-50 px-2.5 py-1 rounded-full">
                {selectedApprovers.length}名選択中
              </span>
            )}
          </div>

          {/* Selected approvers */}
          {selectedApprovers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedApprovers.map((a, i) => (
                <ApproverChip
                  key={a.id}
                  approver={a}
                  index={i}
                  onRemove={() => toggleApprover(a)}
                />
              ))}
            </div>
          )}

          {/* Search */}
          <ApproverSearch selectedApprovers={selectedApprovers} onToggle={toggleApprover} />

          {approverError && (
            <p className="mt-2 text-xs text-red-500">{approverError}</p>
          )}

          {/* Flow preview */}
          {selectedApprovers.length > 1 && (
            <p className="mt-3 text-xs text-gray-400">
              承認順: {selectedApprovers.map((a, i) => `${i + 1}. ${a.full_name}`).join(' → ')}
            </p>
          )}
        </div>

        {/* ── Form fields ── */}
        <div className="px-8 py-6">
          <DynamicForm
            schemaDefinition={template.schema_definition}
            currentVersion={1}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
            isSubmitting={submitMutation.isPending}
            isSavingDraft={saveDraftMutation.isPending}
            submitLabel={
              selectedApprovers.length > 0
                ? `申請する (承認者 ${selectedApprovers.length}名)`
                : '承認者を選択して申請'
            }
          />
        </div>
      </div>

      {/* ── Hint ── */}
      <p className="mt-4 text-center text-xs text-gray-400">
        下書き保存後、後から承認者を追加して申請できます。
      </p>
    </div>
  );
}
