import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';

/**
 * Encabezado único de cada apartado del panel (admin y recepción):
 * título, una línea de descripción y las acciones a la derecha (abajo en el teléfono).
 */
export function SectionHeader({ title, description, actions, className }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <h4 className="text-lg font-bold leading-tight text-brand-navy1">{title}</h4>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
    </div>
  );
}

/** Tarjeta única del panel: fondo blanco, borde suave y esquinas redondeadas */
export function Card({ children, className, title, description, actions }: {
  children: ReactNode;
  className?: string;
  /** Título opcional de la tarjeta (más pequeño que el del apartado) */
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cx('space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h5 className="text-sm font-bold text-brand-navy1">{title}</h5>}
            {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
