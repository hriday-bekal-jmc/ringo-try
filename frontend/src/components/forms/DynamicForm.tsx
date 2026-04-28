import { useState } from 'react';
import { useForm } from 'react-hook-form';
import StandardInput from './StandardInput';
import FileUploadField from './FileUploadField';
import { TemplateSchemaDef } from '../../hooks/useApplication';

type UseFormRegister<T extends Record<string, unknown>> = ReturnType<typeof useForm<T>>['register'];

interface Props {
  schemaDefinition: TemplateSchemaDef;
  currentVersion: number;
  defaultValues?: Record<string, unknown>;
  onSubmit: (payload: { form_data: Record<string, unknown>; version: number }) => void;
  onSaveDraft?: (formData: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  submitLabel?: string;
}

export default function DynamicForm({
  schemaDefinition,
  currentVersion,
  defaultValues,
  onSubmit,
  onSaveDraft,
  isSubmitting,
  isSavingDraft,
  submitLabel,
}: Props) {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<Record<string, unknown>>({ defaultValues: defaultValues ?? {} });

  // File fields managed outside react-hook-form — store Drive file IDs per field
  const fileFields = schemaDefinition.fields.filter((f) => f.type === 'file');
  const [fileValues, setFileValues] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    fileFields.forEach((f) => {
      const def = defaultValues?.[f.name];
      if (Array.isArray(def)) initial[f.name] = def as string[];
      else if (typeof def === 'string' && def) initial[f.name] = [def];
      else initial[f.name] = [];
    });
    return initial;
  });

  const nonFileFields = schemaDefinition.fields.filter((f) => f.type !== 'file');

  function buildFormData(rhfData: Record<string, unknown>) {
    const merged: Record<string, unknown> = { ...rhfData };
    fileFields.forEach((f) => {
      const ids = fileValues[f.name] ?? [];
      merged[f.name] = f.multiple ? ids : (ids[0] ?? '');
    });
    return merged;
  }

  function handleFormSubmit(data: Record<string, unknown>) {
    // Validate required file fields
    for (const f of fileFields) {
      if (f.required && (fileValues[f.name] ?? []).length === 0) {
        alert(`「${f.label}」は必須です。ファイルをアップロードしてください。`);
        return;
      }
    }
    onSubmit({ form_data: buildFormData(data), version: currentVersion });
  }

  function handleSaveDraft() {
    onSaveDraft?.(buildFormData(getValues()));
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="space-y-5">
        {/* Regular fields */}
        {nonFileFields.map((field) => (
          <div
            key={field.name}
            className={field.type === 'textarea' ? 'col-span-2' : ''}
          >
            <StandardInput
              field={field}
              register={register as UseFormRegister<Record<string, unknown>>}
              error={errors[field.name] as import('react-hook-form').FieldError | undefined}
            />
          </div>
        ))}

        {/* File fields */}
        {fileFields.map((field) => (
          <FileUploadField
            key={field.name}
            label={field.label}
            required={field.required}
            multiple={field.multiple}
            value={fileValues[field.name] ?? []}
            onChange={(ids) => setFileValues((prev) => ({ ...prev, [field.name]: ids }))}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
        {onSaveDraft ? (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSavingDraft || isSubmitting}
            className="px-4 py-2 text-sm border border-warm-300 rounded-lg text-gray-600 hover:bg-warm-50 disabled:opacity-50 transition-colors"
          >
            {isSavingDraft ? '保存中...' : '下書き保存'}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={isSubmitting || isSavingDraft}
          className="px-6 py-2.5 text-sm font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {isSubmitting ? '送信中...' : (submitLabel ?? '申請する')}
        </button>
      </div>
    </form>
  );
}
