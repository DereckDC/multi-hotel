/**
 * ¿El usuario puede ver y usar la facturación electrónica del SRI?
 * · Superadmin: siempre.
 * · Admin de hotel y recepción: solo si el anfitrión del establecimiento tiene el módulo SRI pagado
 *   y vigente en su plan (lo responde el servidor con sri_modulo_activo).
 * Devuelve null mientras consulta.
 */
import { useEffect, useState } from 'react';
import { fetchSriModuloActivo } from './subscriptions';

export function useSriModulo(user: { rol?: string; hotelId?: string } | null | undefined): boolean | null {
  const rol = user?.rol;
  const hotelId = user?.hotelId;
  const [activo, setActivo] = useState<boolean | null>(rol === 'super_admin' ? true : null);

  useEffect(() => {
    if (rol === 'super_admin') { setActivo(true); return; }
    if (rol !== 'hotel_admin' && rol !== 'recepcionista') { setActivo(false); return; }
    let vigente = true;
    setActivo(null);
    fetchSriModuloActivo(hotelId).then(v => { if (vigente) setActivo(v); });
    return () => { vigente = false; };
  }, [rol, hotelId]);

  return activo;
}
