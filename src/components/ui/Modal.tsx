import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../utils/cx';
import { useBackHandler } from '../../utils/backButton';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl'
};

/** Capa donde se dibuja: normal (50) o crítica (60, por ejemplo una ventana que va sobre otra) */
const LAYER = { modal: 'z-modal', critical: 'z-critical' } as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Cabecera propia (con botones, por ejemplo). Reemplaza al título y al botón de cerrar de siempre. */
  header?: ReactNode;
  children: ReactNode;
  /** Botones al pie de la ventana */
  footer?: ReactNode;
  size?: ModalSize;
  layer?: keyof typeof LAYER;
  /** Cerrar al tocar fuera de la ventana (por defecto sí) */
  closeOnOverlay?: boolean;
  /** Clases del contenido (por defecto: relleno de 20 px) */
  bodyClassName?: string;
  className?: string;
  id?: string;
}

/** Ventana emergente única de la plataforma: mismo fondo, radio, cabecera y cierre en todas */
export function Modal({
  open, onClose, title, subtitle, header, children, footer, size = 'md', layer = 'modal',
  closeOnOverlay = true, bodyClassName = 'p-5', className, id
}: ModalProps) {
  useBackHandler(open, onClose);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id={id}
      className={cx(
        'fixed inset-0 flex items-center justify-center bg-neutral-950/60 p-2 backdrop-blur-sm animate-fade-in sm:p-4 print:hidden',
        LAYER[layer]
      )}
      style={{ paddingTop: 'max(0.5rem, var(--safe-top))', paddingBottom: 'max(0.5rem, var(--safe-bottom))' }}
      onMouseDown={event => { if (closeOnOverlay && event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl animate-scale-up',
          SIZE[size],
          className
        )}
      >
        {header ? (
          <div className="border-b border-neutral-200 bg-neutral-50">{header}</div>
        ) : title ? (
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-4">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-brand-navy1">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 cursor-pointer rounded-xl p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900 focus-brand"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        <div className={cx('flex-1 overflow-y-auto', bodyClassName)}>{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
