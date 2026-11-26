/**
 * Varias propiedades por anfitrión: la propiedad tiene dueño (hotels.owner_id).
 * El anfitrión (admin de hotel) administra todas sus propiedades; recepción sigue ligada a una.
 * Módulo puro: se prueba con `node --test`.
 */
import { findPlan } from '../../supabase/functions/_shared/plans.ts';

type OwnerLike = { id: string; rol?: string; hotelId?: string };
type HotelLike = { id: string; ownerId?: string | null; tipoEstablecimiento?: string };
type RoomLike = { hotelId: string };

/** Propiedades del usuario: las suyas como dueño y su hotel enlazado (compatibilidad) */
export function ownedHotelIds(user: OwnerLike | null | undefined, hotels: HotelLike[]): string[] {
  if (!user) return [];
  const ids = hotels.filter(h => h.ownerId === user.id).map(h => h.id);
  if (user.hotelId && hotels.some(h => h.id === user.hotelId) && !ids.includes(user.hotelId)) ids.unshift(user.hotelId);
  return ids;
}

/** Cuántas propiedades permite el plan (sin plan: 1) */
export const propertyLimit = (planId: string | null | undefined): number => findPlan(planId)?.props ?? 1;

/** Unidades de una propiedad: sus habitaciones; una casa o departamento completo cuenta como 1 */
export function unitsOfHotel(hotelId: string, hotels: HotelLike[], rooms: RoomLike[]): number {
  const hotel = hotels.find(h => h.id === hotelId);
  if (hotel && (hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento')) return 1;
  return rooms.filter(r => r.hotelId === hotelId).length;
}

/** Unidades de todas las propiedades del anfitrión */
export const unitsOfHotels = (hotelIds: string[], hotels: HotelLike[], rooms: RoomLike[]): number =>
  hotelIds.reduce((sum, id) => sum + unitsOfHotel(id, hotels, rooms), 0);

/** Propiedad activa: la elegida si es del usuario, si no su hotel enlazado o la primera */
export function resolveActiveHotel(ids: string[], preferred: string | null | undefined, linked?: string): string | undefined {
  if (preferred && ids.includes(preferred)) return preferred;
  if (linked && ids.includes(linked)) return linked;
  return ids[0];
}
