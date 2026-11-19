import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';

const CONTROL =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors ' +
  'focus-brand focus:border-brand-cyan disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500';

const border = (invalid?: boolean) => (invalid ? 'border-danger-600' : 'border-neutral-200');

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ invalid, className, ...rest }, ref) {
    return <input ref={ref} className={cx(CONTROL, border(invalid), className)} {...rest} />;
  }
);

/** Lista de opciones: el selector de la plataforma (acepta los mismos <option> que un <select>) */
export { SelectPicker as Select } from './SelectPicker';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ invalid, className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(CONTROL, border(invalid), 'resize-y', className)} {...rest} />;
  }
);

/** Campo con etiqueta, ayuda y mensaje de error */
export function Field({ label, hint, error, required, htmlFor, children }: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}
