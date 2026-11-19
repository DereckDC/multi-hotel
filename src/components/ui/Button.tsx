import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../utils/cx';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'success' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: acción principal (navy) · accent: destacada (cyan, como los botones de los correos)
   *  secondary: alternativa · danger: borrar o cancelar · success: confirmar · ghost: texto · icon: solo ícono */
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl font-bold transition-colors active:scale-95 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-brand';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-navy1 text-white shadow-sm hover:bg-brand-navy-hover',
  accent: 'bg-brand-cyan text-brand-navy2 shadow-sm hover:bg-info-600',
  secondary: 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-700',
  success: 'bg-success-600 text-white shadow-sm hover:bg-success-700',
  ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
  icon: 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-xs'
};

/** Botón único de la plataforma. Por defecto no envía formularios (type="button"). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, leftIcon, className, children, disabled, type = 'button', ...rest },
  ref
) {
  const isIcon = variant === 'icon';
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(BASE, VARIANT[variant], isIcon ? 'p-2' : SIZE[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : leftIcon}
      {children}
    </button>
  );
});
