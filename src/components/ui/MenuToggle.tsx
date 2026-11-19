import { Menu, X } from 'lucide-react';
import { cx } from '../../utils/cx';

interface MenuToggleProps {
  open: boolean;
  onClick: () => void;
  /** Muestra la palabra "Menú" junto al ícono (menú lateral abierto en escritorio) */
  showLabel?: boolean;
  className?: string;
}

/**
 * Botón de menú único de la plataforma (el mismo de la landing): solo el ícono, sin caja,
 * que cambia a una X cuando el menú está abierto. La palabra "Menú" tiene el tamaño de "Volver".
 */
export function MenuToggle({ open, onClick, showLabel = false, className }: MenuToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={open}
      title={open ? 'Cerrar menú' : 'Abrir menú'}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl p-2 text-xs font-bold text-neutral-200 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan',
        className
      )}
    >
      {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      {showLabel && <span className="whitespace-nowrap">Menú</span>}
    </button>
  );
}
