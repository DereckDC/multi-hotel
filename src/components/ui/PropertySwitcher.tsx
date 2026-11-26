/**
 * Selector de la propiedad activa del anfitrión (varias propiedades). Solo aparece cuando el
 * anfitrión tiene más de una; recepción, facturación y el resto del panel trabajan sobre la elegida.
 */
import { SelectPicker } from './SelectPicker';

interface PropertySwitcherProps {
  hotels: Array<{ id: string; nombre: string; tipoEstablecimiento?: string }>;
  value?: string;
  onChange: (hotelId: string) => void;
}

export function PropertySwitcher({ hotels, value, onChange }: PropertySwitcherProps) {
  if (hotels.length < 2) return null;
  return (
    <SelectPicker label="Propiedad activa" showLabel className="w-full sm:w-72" value={value} onChange={e => onChange(e.target.value)}>
      {hotels.map(h => (
        <option key={h.id} value={h.id}>
          {h.nombre.trim()} ({h.tipoEstablecimiento === 'casa' || h.tipoEstablecimiento === 'departamento' ? 'Propiedad' : 'Hotel'})
        </option>
      ))}
    </SelectPicker>
  );
}
