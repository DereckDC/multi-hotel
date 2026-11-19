import type { ComponentType } from 'react';
import { cx } from '../../utils/cx';

interface MenuItemProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  /** Muestra el texto (menú abierto). Cerrado solo se ve el ícono */
  expanded?: boolean;
  /** Colores propios (por ejemplo, Cerrar sesión en rojo) */
  colorClass?: string;
  id?: string;
  /** Permite usarlo en listas (.map) con este proyecto de tipos */
  key?: string | number;
}

/** Ítem del menú de navegación: el mismo en la app (lateral y teléfono) y en la landing */
export function MenuItem({ icon: Icon, label, onClick, active = false, expanded = true, colorClass, id }: MenuItemProps) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      title={!expanded ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative flex h-11 w-full cursor-pointer select-none items-center rounded-xl px-3 text-xs font-semibold transition-all active:scale-95',
        active
          ? 'bg-brand-cyan text-brand-navy2 shadow-sm shadow-brand-cyan/15'
          : colorClass || 'text-neutral-300 hover:bg-white/5 hover:text-white'
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon className="h-5 w-5" />
      </span>
      <span className={cx('whitespace-nowrap transition-all duration-300', expanded ? 'ml-3 block opacity-100' : 'hidden opacity-0')}>
        {label}
      </span>
    </button>
  );
}
