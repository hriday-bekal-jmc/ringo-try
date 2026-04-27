import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useTemplate,
  useApprovers,
  useSubmitApplication,
  useSaveDraft,
  Approver,
} from '../hooks/useApplication';
import { recordTemplateVisit } from './Dashboard';
import DynamicForm from '../components/forms/DynamicForm';
import Modal from '../components/common/Modal';
import Header from '../components/common/Header';

export default function Application() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useTemplate(templateId!);

  useEffect(() => {
    if (templateId) recordTemplateVisit(templateId);
  }, [templateId]);
  const submitMutation = useSubmitApplication();
  const saveDraftMutation = useSaveDraft();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedApprovers, setSelectedApprovers] = useState<Approver[]>([]);
  const { data: approvers } = useApprovers(search);

  if (isLoading || !template) {
    return <div className="text-gray-400 py-12 text-center">フォームを読み込み中...</div>;
  }

  async function handleSubmit(payload: { form_data: Record<string, unknown>; version: number }) {
    if (selectedApprovers.length === 0) {
      alert('承認者を1名以上選択してください。');
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
      const result = await saveDraftMutation.mutateAsync({
        templateId: template!.id,
        formData,
      });
      navigate(`/applications/${result.id}`);
    } catch {
      alert('下書きの保存に失敗しました。もう一度お試しください。');
    }
  }

  function toggleApprover(approver: Approver) {
    setSelectedApprovers((prev) => {
      const exists = prev.find((a) => a.id === approver.id);
      return exists ? prev.filter((a) => a.id !== approver.id) : [...prev, approver];
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Header
        title={template.title}
        subtitle={template.title_en}
        action={
          <button
            onClick={() => setPickerOpen(true)}
            className="px-4 py-2 text-sm border border-warm-300 rounded-lg hover:bg-warm-50 transition-colors"
          >
            承認者を選択 ({selectedApprovers.length}名)
          </button>
        }
      />

      {selectedApprovers.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 mb-2">承認フロー:</p>
          <div className="flex flex-wrap gap-2">
            {selectedApprovers.map((a, i) => (
              <span key={a.id} className="text-xs bg-white border rounded-full px-3 py-1 text-gray-700">
                {i + 1}. {a.full_name} ({a.role})
              </span>
            ))}
          </div>
        </div>
      )}

      <DynamicForm
        schemaDefinition={template.schema_definition}
        currentVersion={1}
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
        isSubmitting={submitMutation.isPending}
        isSavingDraft={saveDraftMutation.isPending}
      />

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="承認者を選択">
        <div className="space-y-3">
          <input
            type="text"
            placeholder="名前を検索 (2文字以上)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <div className="max-h-64 overflow-y-auto divide-y">
            {approvers?.map((a) => {
              const selected = selectedApprovers.some((s) => s.id === a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleApprover(a)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    selected ? 'bg-blue-50' : ''
                  }`}
                >
                  <div>
                    <span className="font-medium text-gray-800">{a.full_name}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {a.role} · {a.department_name}
                    </span>
                  </div>
                  {selected && <span className="text-brand-600 text-xs font-semibold">✓ 選択済み</span>}
                </button>
              );
            })}
            {approvers?.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">該当者が見つかりません</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setPickerOpen(false)}
              className="px-4 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700"
            >
              確定 ({selectedApprovers.length}名)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
