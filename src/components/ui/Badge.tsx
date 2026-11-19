import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';

const TONE: Record<BadgeTone, string> = {
  success: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  danger: 'bg-danger-50 text-danger-700 border-danger-100',
  info: 'bg-info-50 text-info-700 border-info-100',
  brand: 'bg-brand-navy1 text-white border-brand-navy1',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200'
};

/** Etiqueta pequeña de estado (Pendiente, Confirmada, Activo…) */
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-bold uppercase tracking-wide',
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
