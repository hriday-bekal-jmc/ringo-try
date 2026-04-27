import { useForm } from 'react-hook-form';
import StandardInput from './StandardInput';
import { TemplateSchemaDef } from '../../hooks/useApplication';

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

  function handleFormSubmit(data: Record<string, unknown>) {
    onSubmit({ form_data: data, version: currentVersion });
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="bg-white p-6 shadow-md rounded-lg space-y-6"
    >
      <h2 className="text-xl font-bold text-gray-800">{schemaDefinition.template_name}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {schemaDefinition.fields.map((field) => (
          <div
            key={field.name}
            className={field.type === 'textarea' ? 'md:col-span-2' : ''}
          >
            <StandardInput
              field={field}
              register={register as UseFormRegister<Record<string, unknown>>}
              error={errors[field.name] as import('react-hook-form').FieldError | undefined}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        {onSaveDraft ? (
          <button
            type="button"
            onClick={() => onSaveDraft(getValues())}
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
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          {isSubmitting ? '送信中...' : (submitLabel ?? '申請する')}
        </button>
      </div>
    </form>
  );
}

type UseFormRegister<T extends Record<string, unknown>> = ReturnType<typeof useForm<T>>['register'];
