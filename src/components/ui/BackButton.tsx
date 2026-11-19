import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { cx } from '../../utils/cx';

/** Lugar del encabezado (arriba a la derecha) donde se coloca el botón Volver de cada pantalla */
export const HEADER_ACTIONS_ID = 'roomia-header-actions';

interface BackButtonProps {
  onClick: () => void;
  /** dark: sobre el encabezado azul o la landing · light: sobre fondo claro */
  tone?: 'dark' | 'light';
  className?: string;
}

/**
 * Botón Volver único de la plataforma: flecha + "Volver".
 * En pantallas angostas solo se ve la flecha (el texto queda para lectores de pantalla).
 */
export function BackButton({ onClick, tone = 'dark', className }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Volver"
      title="Volver"
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-colors active:scale-95 focus-brand sm:px-3',
        tone === 'dark'
          ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
        className
      )}
    >
      <ArrowLeft className={cx('h-4 w-4', tone === 'dark' ? 'text-brand-cyan' : 'text-brand-navy1')} aria-hidden="true" />
      <span className="hidden sm:inline">Volver</span>
    </button>
  );
}

/**
 * Pone el botón Volver en el encabezado de la app (arriba a la derecha), aunque la pantalla que lo
 * pide esté más abajo. Si el encabezado no existe (por ejemplo, la página de pago), se dibuja en su lugar.
 */
export function HeaderBackButton({ onClick }: { onClick: () => void }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(HEADER_ACTIONS_ID));
  }, []);
  if (!slot) return null;
  return createPortal(<BackButton onClick={onClick} tone="dark" />, slot);
}
