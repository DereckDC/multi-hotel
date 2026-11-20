import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cx } from '../../utils/cx';

export interface PickerOption {
  value: string;
  label: string;
  /** Encabezado de grupo (equivale a <optgroup>) */
  group?: string;
  disabled?: boolean;
}

interface OptionPickerProps {
  /** Nombre corto del filtro (texto pequeño de arriba y título de la hoja) */
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  /** Texto que se muestra mientras no se eligió nada (cuando value === emptyValue) */
  placeholder?: string;
  emptyValue?: string;
  icon?: ComponentType<{ className?: string }>;
  /** light: sobre fondo claro (plataforma) · dark: sobre fondo oscuro (landing) */
  tone?: 'light' | 'dark';
  /** md: filtros y formularios · sm: tablas y barras apretadas (sin rótulo, letra 12px) */
  size?: 'md' | 'sm';
  /** Oculta el rótulo pequeño cuando el formulario ya lo muestra arriba */
  hideLabel?: boolean;
  disabled?: boolean;
  /** Valida el formulario como un <select required> */
  required?: boolean;
  name?: string;
  id?: string;
  title?: string;
  className?: string;
}

const PHONE = '(max-width: 639px)';
/** A partir de cuántas opciones aparece el buscador */
const SEARCH_FROM = 9;

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Selector de opciones de la plataforma (reemplaza al <select> del navegador).
 * · Teléfono: se abre como hoja desde abajo (bottom sheet), con opciones grandes para el dedo.
 * · Escritorio: lista flotante bajo el botón (o encima, si no hay lugar), con teclado
 *   (flechas, Enter, Escape). Se dibuja sobre la página, así no la corta una tabla con desplazamiento.
 * Con muchas opciones muestra un buscador. Usa dos tamaños de letra y dos colores.
 */
export function OptionPicker({
  label, value, options, onChange, placeholder, emptyValue, icon: Icon, tone = 'light', size = 'md',
  hideLabel = false, disabled = false, required = false, name, id, title, className
}: OptionPickerProps) {
  const dark = tone === 'dark';
  const small = size === 'sm';
  const [open, setOpen] = useState<null | 'sheet' | 'menu'>(null);
  const [query, setQuery] = useState('');
  const [menuBox, setMenuBox] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find(o => o.value === value);
  const isEmpty = emptyValue !== undefined && value === emptyValue;
  const shown = isEmpty ? (placeholder || selected?.label || '') : (selected?.label || placeholder || '');
  const searchable = options.length >= SEARCH_FROM;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter(o => normalize(o.label).includes(q)) : options;
  }, [options, query]);

  const openPicker = () => {
    if (disabled) return;
    setQuery('');
    setOpen(window.matchMedia(PHONE).matches ? 'sheet' : 'menu');
  };

  const close = (refocus = true) => {
    setOpen(null);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (next: string) => {
    onChange(next);
    close();
  };

  // Ubica la lista de escritorio junto al botón (debajo, o encima si no hay espacio)
  useLayoutEffect(() => {
    if (open !== 'menu') return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const width = Math.max(rect.width, 224);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      if (below >= 220 || below >= above) {
        setMenuBox({ left, top: rect.bottom + 6, width, maxHeight: Math.min(320, below) });
      } else {
        setMenuBox({ left, bottom: window.innerHeight - rect.top + 6, width, maxHeight: Math.min(320, above) });
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Cierra la lista de escritorio al tocar fuera
  useEffect(() => {
    if (open !== 'menu') return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Con la hoja abierta la página de fondo no se desplaza
  useEffect(() => {
    if (open !== 'sheet') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Al abrir, el foco va al buscador o a la opción elegida
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const current = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
        || listRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
      current?.scrollIntoView({ block: 'nearest' });
      if (searchable && open === 'menu') searchRef.current?.focus();
      else current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, menuBox === null]);

  const moveFocus = (step: 1 | -1) => {
    const items: HTMLButtonElement[] = listRef.current
      ? Array.from(listRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'))
      : [];
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = index < 0 ? (step === 1 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, index + step));
    items[next]?.focus();
  };

  const onListKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab' && open === 'menu') {
      close(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    moveFocus(event.key === 'ArrowDown' ? 1 : -1);
  };

  const searchBox = searchable && (
    <div className={cx('relative mb-1.5', open === 'sheet' && 'mx-1')}>
      <Search className={cx('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', dark ? 'text-white/60' : 'text-neutral-500')} />
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            const first = visible.find(o => !o.disabled);
            if (first) choose(first.value);
            return;
          }
          onListKey(event);
        }}
        placeholder="Buscar…"
        aria-label={`Buscar en ${label}`}
        className={cx(
          'w-full rounded-xl border py-2 pl-9 pr-3 text-sm focus:outline-none',
          dark ? 'border-white/15 bg-white/5 text-white placeholder:text-white/60 focus:border-brand-cyan' : 'border-neutral-200 bg-neutral-50 text-brand-navy1 placeholder:text-neutral-500 focus:border-brand-cyan'
        )}
      />
    </div>
  );

  const list = (big: boolean) => {
    let lastGroup: string | undefined;
    return (
      <div ref={listRef} id={listId} role="listbox" aria-label={label} onKeyDown={onListKey} className="space-y-0.5">
        {visible.length === 0 && (
          <p className={cx('px-3 py-3 text-sm', dark ? 'text-white/60' : 'text-neutral-500')}>Sin resultados</p>
        )}
        {visible.map(option => {
          const active = option.value === value;
          const header = option.group && option.group !== lastGroup ? option.group : null;
          lastGroup = option.group;
          return (
            <div key={`${option.group || ''}·${option.value}`}>
              {header && (
                <p className={cx('px-3 pb-1 pt-2.5 text-micro font-semibold uppercase tracking-wider', dark ? 'text-white/60' : 'text-neutral-500')}>
                  {header}
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                onClick={() => choose(option.value)}
                className={cx(
                  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-left transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  big ? 'py-3.5 text-sm' : (small ? 'py-2 text-xs' : 'py-2.5 text-sm'),
                  dark
                    ? (active ? 'bg-brand-cyan/15 font-bold text-brand-cyan' : 'font-medium text-white hover:bg-white/10 focus-visible:bg-white/10')
                    : (active ? 'bg-info-50 font-bold text-brand-navy1' : 'font-medium text-brand-navy1 hover:bg-neutral-100 focus-visible:bg-neutral-100')
                )}
              >
                <span>{option.label}</span>
                {active && <Check className={cx('h-4 w-4 shrink-0', dark ? 'text-brand-cyan' : 'text-info-600')} aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={wrapRef} className={cx('relative', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open !== null}
        aria-controls={open ? listId : undefined}
        aria-label={hideLabel || small ? `${label}: ${shown}` : undefined}
        onClick={() => (open ? close(false) : openPicker())}
        onKeyDown={event => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) {
            event.preventDefault();
            openPicker();
          }
        }}
        className={cx(
          'flex h-full w-full cursor-pointer items-center rounded-xl border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan disabled:cursor-not-allowed disabled:opacity-60',
          small ? 'gap-2 px-2.5 py-2' : hideLabel ? 'gap-3 px-3.5 py-2.5' : 'gap-3 px-3.5 py-2.5 shadow-sm',
          dark ? 'bg-neutral-950' : 'bg-white',
          open ? 'border-brand-cyan' : (dark ? 'border-white/15 hover:border-brand-cyan' : 'border-neutral-200 hover:border-brand-cyan')
        )}
      >
        {Icon && <Icon className={cx('h-4 w-4 shrink-0', dark ? 'text-white/60' : 'text-neutral-500')} />}
        <span className="min-w-0 flex-1">
          {!hideLabel && !small && (
            <span className={cx('block text-micro font-semibold uppercase tracking-wider', dark ? 'text-white/60' : 'text-neutral-500')}>{label}</span>
          )}
          <span className={cx(
            'block font-semibold leading-snug',
            small ? 'truncate text-xs' : hideLabel ? 'truncate text-sm' : 'line-clamp-2 text-sm',
            dark ? 'text-white' : 'text-brand-navy1'
          )}>{shown}</span>
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 transition-transform', dark ? 'text-white/60' : 'text-neutral-500', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {/* Validación del formulario como un <select required> */}
      {(required || name) && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          value={value}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      )}

      {open === 'menu' && menuBox && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: menuBox.left, top: menuBox.top, bottom: menuBox.bottom, width: menuBox.width, maxHeight: menuBox.maxHeight }}
          className={cx(
            'z-critical flex flex-col overflow-hidden rounded-2xl border p-1.5 shadow-xl animate-fade-in print:hidden',
            dark ? 'border-white/15 bg-neutral-950' : 'border-neutral-200 bg-white'
          )}
        >
          {searchBox}
          <div className="overflow-y-auto">{list(false)}</div>
        </div>,
        document.body
      )}

      {open === 'sheet' && createPortal(
        <div className="fixed inset-0 z-critical flex items-end print:hidden" role="dialog" aria-modal="true" aria-label={label}>
          <div className="absolute inset-0 bg-neutral-950/50 animate-fade-in" onClick={() => close()} />
          <div
            className={cx('relative flex max-h-[75vh] w-full flex-col rounded-t-3xl shadow-xl animate-sheet-up', dark ? 'border-t border-white/15 bg-neutral-950' : 'bg-white')}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className={cx('mx-auto mt-2.5 h-1.5 w-10 rounded-full', dark ? 'bg-white/20' : 'bg-neutral-200')} aria-hidden="true" />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <span className={cx('text-sm font-bold', dark ? 'text-white' : 'text-brand-navy1')}>{label}</span>
              <button
                type="button"
                onClick={() => close()}
                aria-label="Cerrar"
                className={cx('cursor-pointer rounded-xl p-2 focus-brand', dark ? 'text-white/60 hover:bg-white/10' : 'text-neutral-500 hover:bg-neutral-100')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3">{searchBox}</div>
            <div className="overflow-y-auto px-3 pb-4">{list(true)}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
