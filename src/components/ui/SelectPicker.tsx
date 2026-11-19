import { Children, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import { OptionPicker, type PickerOption } from './OptionPicker';
import { cx } from '../../utils/cx';

/** Lo que recibe onChange: igual que un <select>, para no tocar los manejadores existentes */
export interface SelectPickerChange {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
}

export interface SelectPickerProps {
  value?: string | number | readonly string[] | null;
  defaultValue?: string | number;
  onChange?: (event: SelectPickerChange) => void;
  children?: ReactNode;
  /** Nombre del selector: título de la hoja en el teléfono y texto para lectores de pantalla */
  label?: string;
  'aria-label'?: string;
  title?: string;
  /** md: formularios y filtros · sm: tablas y barras apretadas. Si no se indica, se deduce del className */
  size?: 'md' | 'sm';
  tone?: 'light' | 'dark';
  /** Muestra el nombre arriba del valor (cuando no hay otro rótulo a la vista) */
  showLabel?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  key?: string | number;
}

/** Del className del antiguo <select> solo se conservan ancho y posición: el aspecto lo pone el selector */
const LAYOUT = /^(?:[a-z]{2}:)?(?:w-|min-w-|max-w-|flex-|shrink|grow|basis-|col-span|row-span|-?m[trblxy]?-|self-|order-|hidden$|block$|inline-block$)/;
/** Clases de los selectores pequeños de tablas y barras */
const SMALL = /(?:^|\s)(?:text-micro|py-0\.5|py-1(?!\.5|\d)|p-1(?!\.5|\d))(?:\s|$)/;

const textOf = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
};

/** Lee los <option> y <optgroup> (también los generados con .map) */
function readOptions(children: ReactNode, group?: string): PickerOption[] {
  const out: PickerOption[] = [];
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{ value?: unknown; label?: string; disabled?: boolean; hidden?: boolean; children?: ReactNode }>;
    if (element.type === 'optgroup') {
      out.push(...readOptions(element.props.children, element.props.label));
      return;
    }
    if (element.type === 'option') {
      if (element.props.hidden) return;
      const label = textOf(element.props.children).trim();
      const value = element.props.value === undefined ? label : String(element.props.value);
      out.push({ value, label, group, disabled: element.props.disabled });
      return;
    }
    // Fragmentos u otros contenedores
    out.push(...readOptions(element.props.children, group));
  });
  return out;
}

/**
 * Reemplazo directo de <select>: recibe los mismos <option> y el mismo onChange (e.target.value),
 * pero se ve y se usa como el selector de la plataforma (lista en escritorio, hoja inferior en el teléfono).
 */
export function SelectPicker({
  value, defaultValue, onChange, children, label, title, size, tone, showLabel = false, disabled, required, name, id, className, ...rest
}: SelectPickerProps) {
  const options = readOptions(children);
  const [inner, setInner] = useState(() => String(defaultValue ?? options[0]?.value ?? ''));
  const controlled = value !== undefined && value !== null;
  const current = controlled ? String(value) : inner;

  const layout = (className || '').split(/\s+/).filter(token => LAYOUT.test(token));
  const resolvedSize = size || (SMALL.test(` ${className || ''} `) ? 'sm' : 'md');
  const name_ = label || rest['aria-label'] || title || 'Elige una opción';

  return (
    <OptionPicker
      label={name_}
      hideLabel={!showLabel}
      size={resolvedSize}
      tone={tone}
      value={current}
      options={options}
      disabled={disabled}
      required={required}
      name={name}
      id={id}
      title={title}
      className={cx(layout.join(' '))}
      onChange={next => {
        if (!controlled) setInner(next);
        const event: SelectPickerChange = { target: { value: next, name }, currentTarget: { value: next, name } };
        onChange?.(event);
      }}
    />
  );
}
