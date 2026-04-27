import { FieldError, UseFormRegister } from 'react-hook-form';
import { FieldDef } from '../../hooks/useApplication';

interface Props {
  field: FieldDef;
  register: UseFormRegister<Record<string, unknown>>;
  error?: FieldError;
}

export default function StandardInput({ field, register, error }: Props) {
  const baseClass =
    'block w-full rounded border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {field.type === 'select' && field.options && (
        <select {...register(field.name, { required: field.required })} className={baseClass}>
          <option value="">-- 選択してください --</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === 'date' && (
        <input
          type="date"
          {...register(field.name, { required: field.required })}
          className={baseClass}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          {...register(field.name, { required: field.required })}
          rows={3}
          className={baseClass}
        />
      )}

      {field.type === 'text' && (
        <input
          type="text"
          {...register(field.name, { required: field.required })}
          className={baseClass}
        />
      )}

      {error && (
        <p className="text-xs text-red-500">必須項目です (Required)</p>
      )}
    </div>
  );
}
