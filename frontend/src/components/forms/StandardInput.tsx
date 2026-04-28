import { FieldError, UseFormRegister } from 'react-hook-form';
import { FieldDef } from '../../hooks/useApplication';

interface Props {
  field: FieldDef;
  register: UseFormRegister<Record<string, unknown>>;
  error?: FieldError;
}

const inputClass =
  'block w-full rounded-lg border border-warm-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 ' +
  'placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 ' +
  'transition-colors';

export default function StandardInput({ field, register, error }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-1 text-red-400 text-xs">必須</span>}
      </label>

      {field.type === 'select' && field.options && (
        <select
          {...register(field.name, { required: field.required })}
          className={inputClass}
        >
          <option value="">-- 選択してください --</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === 'date' && (
        <input
          type="date"
          {...register(field.name, { required: field.required })}
          className={inputClass}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          {...register(field.name, { required: field.required })}
          rows={4}
          className={`${inputClass} resize-y`}
        />
      )}

      {field.type === 'text' && (
        <input
          type="text"
          {...register(field.name, { required: field.required })}
          className={inputClass}
        />
      )}

      {error && (
        <p className="text-xs text-red-500">必須項目です</p>
      )}
    </div>
  );
}
