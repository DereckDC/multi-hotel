/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Hotel, Room, User, Reservation, ChatMessage, PaymentTransaction, Review, RoomPriceVariation } from './types';
import { ActivityLog } from './store';

// Credentials are loaded strictly from secure environment variables (via dynamic endpoint/window first, fallback to process/meta) to comply with OWASP Top 10 and prevent hardcoded secrets.
const win = typeof window !== 'undefined' ? (window as any) : {};

const cleanEnvValue = (val: string): string => {
  if (!val) return '';
  let s = val.trim();
  // Strip outer quotes if any (both single and double)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Sanitize literal string "undefined" or "null" which may be injected by static host bundlers
  if (s === 'undefined' || s === 'null' || s === '' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') {
    return '';
  }
  return s;
};

// Environment credentials loaded strictly from .env variables via win.__SUPABASE_ENV__, process.env, or import.meta.env
const getSanitizedEnv = () => {
  let url = win.__SUPABASE_ENV__?.VITE_SUPABASE_URL || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || (import.meta as any).env?.VITE_SUPABASE_URL || '';
  let key = win.__SUPABASE_ENV__?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  url = cleanEnvValue(url);
  key = cleanEnvValue(key);

  return { url, key };
};

const sanitizedEnv = getSanitizedEnv();
const rawUrl = sanitizedEnv.url;
const SUPABASE_ANON_KEY = sanitizedEnv.key;

// Sanitize URL to ensure the client-side SDK gets the base address without /rest/v1 suffix and without trailing slash
const SUPABASE_URL = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '').trim() : '';

// Dynamically compute local storage token key based on project reference subdomain
const getProjectRef = (url: string) => {
  try {
    if (!url) return 'supabase';
    const hostname = new URL(url).hostname;
    return hostname.split('.')[0] || 'supabase';
  } catch (e) {
    return 'supabase';
  }
};
const sbTokenKey = `sb-${getProjectRef(SUPABASE_URL)}-auth-token`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("⚠️ ALERTA DE CONFIGURACIÓN: No se encontraron las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env.");
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Self-healing: Detect and handle invalid refresh tokens or failed fetches gracefully
if (typeof window !== 'undefined') {
  // Console interceptor to silently suppress and auto-heal invalid refresh token logs
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const msg = args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      } catch (e) {
        return String(arg);
      }
    }).join(' ').toLowerCase();

    if (msg.includes('refresh token') || msg.includes('invalid_grant')) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
        localStorage.removeItem(sbTokenKey);
        localStorage.removeItem('aura_hotel_pms_current_user_id');
      } catch (e) {
        // storage disabled or error
      }
      return;
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function (...args: any[]) {
    const msg = args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      } catch (e) {
        return String(arg);
      }
    }).join(' ').toLowerCase();

    if (msg.includes('refresh token') || msg.includes('invalid_grant')) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
        localStorage.removeItem(sbTokenKey);
        localStorage.removeItem('aura_hotel_pms_current_user_id');
      } catch (e) {
        // storage disabled or error
      }
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  // 1. Check initial session to catch auth/refresh errors before they bubble up
  supabase.auth.getSession().then(({ error }) => {
    if (error) {
      if (error.message?.toLowerCase().includes('refresh token') || error.message?.toLowerCase().includes('invalid_grant')) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              localStorage.removeItem(key);
            }
          }
          localStorage.removeItem(sbTokenKey);
          localStorage.removeItem('aura_hotel_pms_current_user_id');
          supabase.auth.signOut().catch(() => {});
        } catch (e) {
          // storage disabled or error
        }
      }
    }
  }).catch((err) => {
    // silently catch
  });

  // 2. Intercept unhandled promise rejections (often fired by library background refresh threads)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason) {
      let msg = '';
      try {
        msg = (reason.message || reason.error_description || reason.error || JSON.stringify(reason) || '').toLowerCase();
      } catch (e) {
        msg = String(reason || '').toLowerCase();
      }

      if (msg.includes('refresh token') || msg.includes('invalid_grant') || msg.includes('failed to fetch') || msg.includes('fetch') || msg.includes('network error')) {
        if (msg.includes('refresh token') || msg.includes('invalid_grant')) {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
              }
            }
            localStorage.removeItem(sbTokenKey);
            localStorage.removeItem('aura_hotel_pms_current_user_id');
            supabase.auth.signOut().catch(() => {});
          } catch (e) {
            // storage disabled or error
          }
        }
        event.preventDefault(); // Stop from reaching browser console as uncaught
      }
    }
  });

  // 3. Intercept general window runtime errors
  window.addEventListener('error', (event) => {
    const msg = String(event.message || '').toLowerCase();
    if (msg.includes('refresh token') || msg.includes('invalid_grant') || msg.includes('failed to fetch') || msg.includes('fetch') || msg.includes('network error')) {
      if (msg.includes('refresh token') || msg.includes('invalid_grant')) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              localStorage.removeItem(key);
            }
          }
          localStorage.removeItem(sbTokenKey);
          localStorage.removeItem('aura_hotel_pms_current_user_id');
          supabase.auth.signOut().catch(() => {});
        } catch (e) {
          // storage disabled or error
        }
      }
      event.preventDefault(); // Stop propagation
    }
  }, true);
}

/**
 * Nota: El esquema completo de inicialización de Supabase con sus políticas RLS
 * se encuentra ahora en el archivo principal /supabase_schema.sql para despliegues limpios y manuales.
 */

/**
 * Uploads/Syncs a single hotel to Supabase
 */
export function mapHotelToDb(hotel: Hotel): any {
  const contactoDb = {
    ...(hotel.contacto || {}),
    serviciosExtra: hotel.serviciosDetallados || [],
    tipoEstablecimiento: hotel.tipoEstablecimiento || 'hotel',
    finalidad: hotel.finalidad || null,
    propietario: hotel.propietario || null,
    detallesInmueble: hotel.detallesInmueble || null
  };
  return {
    id: hotel.id,
    nombre: hotel.nombre,
    logo: hotel.logo || null,
    portada: hotel.portada || null,
    imagenes: hotel.imagenes || [],
    descripcion: hotel.descripcion || '',
    ubicacion: hotel.ubicacion || '',
    coordenadas: hotel.coordenadas || { lat: 19.4273, lng: -99.1676 },
    googlemapsurl: hotel.googleMapsUrl || null,
    servicios: hotel.servicios || [],
    politicas: hotel.politicas || [],
    horarios: hotel.horarios || { checkIn: "15:00", checkOut: "12:00" },
    contacto: contactoDb,
    redessociales: hotel.redesSociales || {},
    estado: hotel.estado || 'activo'
  };
}

export function mapHotelFromDb(db: any): Hotel {
  if (!db) return db;
  const contacto = db.contacto || {};
  const serviciosDetallados = contacto.serviciosExtra || [];
  const tipoEstablecimiento = contacto.tipoEstablecimiento || db.tipoEstablecimiento || 'hotel';
  const finalidad = contacto.finalidad || db.finalidad || null;
  const propietario = contacto.propietario || db.propietario || null;
  const detallesInmueble = contacto.detallesInmueble || db.detallesInmueble || null;
  return {
    id: db.id,
    nombre: db.nombre,
    logo: db.logo || '',
    portada: db.portada || '',
    imagenes: db.imagenes || [],
    descripcion: db.descripcion || '',
    ubicacion: db.ubicacion || '',
    coordenadas: db.coordenadas || { lat: 19.4273, lng: -99.1676 },
    googleMapsUrl: db.googlemapsurl !== undefined ? db.googlemapsurl : (db.googleMapsUrl || ''),
    servicios: db.servicios || [],
    politicas: db.politicas || [],
    horarios: db.horarios || { checkIn: '15:00', checkOut: '12:00' },
    contacto: contacto,
    serviciosDetallados: serviciosDetallados,
    redesSociales: db.redessociales !== undefined ? db.redesSociales : (db.redesSociales || {}),
    estado: db.estado || 'activo',
    tipoEstablecimiento: tipoEstablecimiento,
    finalidad: finalidad,
    propietario: propietario,
    detallesInmueble: detallesInmueble
  };
}

export function mapRoomToDb(room: Room): any {
  return {
    id: room.id,
    hotelid: room.hotelId,
    numero: room.numero,
    nombre: room.nombre,
    tipo: room.tipo,
    precio: room.precio,
    capacidad: room.capacidad,
    camas: room.camas,
    estado: room.estado,
    imagenes: room.imagenes || [],
    descripcion: room.descripcion || '',
    servicios: room.servicios || [],
    adicionar_iva: room.adicionarIva !== false
  };
}

export function mapRoomFromDb(db: any): Room {
  if (!db) return db;
  return {
    id: db.id,
    hotelId: db.hotelid !== undefined ? db.hotelid : (db.hotelId || ''),
    numero: db.numero || '',
    nombre: db.nombre || '',
    tipo: db.tipo || 'Estándar',
    precio: Number(db.precio || 0),
    capacidad: Number(db.capacidad || 1),
    camas: Number(db.camas || 1),
    estado: db.estado || 'disponible',
    imagenes: db.imagenes || [],
    descripcion: db.descripcion || '',
    servicios: db.servicios || db.amenidades || [],
    adicionarIva: db.adicionar_iva !== undefined ? db.adicionar_iva : (db.adicionarIva !== false)
  };
}

export function mapUserToDb(user: User): any {
  return {
    id: user.id,
    nombre: user.nombre || 'Usuario',
    apellido: user.apellido || 'Roomia',
    email: user.email,
    telefono: user.telefono || '',
    documento: user.documento || '',
    avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    rol: user.rol || 'cliente',
    fecharegistro: user.fechaRegistro || new Date().toISOString().split('T')[0],
    estado: user.estado || 'activo',
    hotelid: user.hotelId || null,
    debecambiarpassword: user.debeCambiarPassword !== undefined ? user.debeCambiarPassword : false
  };
}

export function mapUserFromDb(db: any): User {
  if (!db) return db;
  return {
    id: db.id,
    nombre: db.nombre || 'Usuario',
    apellido: db.apellido || 'Roomia',
    email: db.email || '',
    telefono: db.telefono || '',
    documento: db.documento || '',
    avatar: db.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    rol: db.rol || 'cliente',
    fechaRegistro: db.fecharegistro !== undefined ? db.fecharegistro : (db.fechaRegistro || new Date().toISOString().split('T')[0]),
    estado: db.estado || 'activo',
    hotelId: db.hotelid !== undefined ? db.hotelid : db.hotelId,
    debeCambiarPassword: db.debecambiarpassword !== undefined ? db.debecambiarpassword : false
  };
}

export function mapReservationToDb(res: Reservation): any {
  const entrada = new Date(res.fechaEntrada);
  const salida = new Date(res.fechaSalida);
  const diffTime = Math.abs(salida.getTime() - entrada.getTime());
  const nochesCalc = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  let dbNotes = res.notas || '';
  if (res.montoPagado !== undefined || res.montoPendiente !== undefined) {
    dbNotes = dbNotes.replace(/\s*\[PAYMENT_INFO:.*?\]/g, '').trim();
    dbNotes += (dbNotes ? ' ' : '') + `[PAYMENT_INFO:${JSON.stringify({ montoPagado: res.montoPagado, montoPendiente: res.montoPendiente })}]`;
  }

  return {
    id: res.id,
    roomid: res.roomId || null, // Nullable para estadías completas de casas/departamentos
    hotelid: res.hotelId,
    guestid: res.guestId,
    fechaentrada: res.fechaEntrada,
    fechasalida: res.fechaSalida,
    noches: (res as any).noches || nochesCalc,
    total: res.total,
    estado: res.estado,
    qrcode: res.qrCode || '',
    checkedinat: res.checkedInAt || null,
    checkedoutat: res.checkedOutAt || null,
    recepcionistaid: res.recepcionistaId || null,
    modificadopor: res.modificadoPor || null,
    mensajecambio: res.mensajeCambio || null,
    fechacambio: res.fechaCambio || null,
    eliminadaporcliente: res.eliminadaPorCliente === undefined ? false : res.eliminadaPorCliente,
    serviciosadicionales: res.serviciosAdicionales || [],
    subtotal: res.subtotal || 0,
    impuestos: res.impuestos || 0,
    notes: dbNotes,
    cambiadoporid: res.cambiadoPorId || null,
    reservation_type: res.reservationType || 'hospedaje'
  };
}

export function mapReservationFromDb(db: any): Reservation {
  if (!db) return db;
  const rawNotes = db.notes || db.notas || '';
  let montoPagado: number | undefined;
  let montoPendiente: number | undefined;
  let cleanNotes = rawNotes;

  const paymentMatch = rawNotes.match(/\[PAYMENT_INFO:(.*?)\]/);
  if (paymentMatch) {
    try {
      const parsed = JSON.parse(paymentMatch[1]);
      montoPagado = parsed.montoPagado;
      montoPendiente = parsed.montoPendiente;
      cleanNotes = rawNotes.replace(/\s*\[PAYMENT_INFO:.*?\]/g, '').trim();
    } catch (e) {
      console.warn("Failed to parse payment info from notes", e);
    }
  }

  return {
    id: db.id,
    roomId: db.roomid !== undefined ? db.roomid : (db.roomId || null),
    hotelId: db.hotelid !== undefined ? db.hotelid : (db.hotelId || ''),
    guestId: db.guestid !== undefined ? db.guestid : (db.guestId || ''),
    fechaEntrada: db.fechaentrada !== undefined ? db.fechaentrada : (db.fechaEntrada || ''),
    fechaSalida: db.fechasalida !== undefined ? db.fechasalida : (db.fechaSalida || ''),
    noches: Number(db.noches || 1),
    total: Number(db.total || 0),
    estado: db.estado || 'pendiente',
    qrCode: db.qrcode !== undefined ? db.qrcode : (db.qrCode || ''),
    checkedInAt: db.checkedinat !== undefined ? db.checkedinat : (db.checkedInAt || undefined),
    checkedOutAt: db.checkedoutat !== undefined ? db.checkedoutat : (db.checkedOutAt || undefined),
    recepcionistaId: db.recepcionistaid !== undefined ? db.recepcionistaid : (db.recepcionistaId || undefined),
    modificadoPor: db.modificadopor !== undefined ? db.modificadopor : (db.modificadoPor || undefined),
    mensajeCambio: db.mensajecambio !== undefined ? db.mensajecambio : (db.mensajeCambio || undefined),
    fechaCambio: db.fechacambio !== undefined ? db.fechacambio : (db.fechaCambio || undefined),
    eliminadaPorCliente: db.eliminadaporcliente !== undefined ? db.eliminadaporcliente : (db.eliminadaPorCliente || false),
    serviciosAdicionales: db.serviciosadicionales || db.serviciosAdicionales || [],
    subtotal: Number(db.subtotal || 0),
    impuestos: Number(db.impuestos || 0),
    notas: cleanNotes,
    montoPagado,
    montoPendiente,
    cambiadoPorId: db.cambiadoporid !== undefined ? db.cambiadoporid : (db.cambiadoPorId || undefined),
    fechaRegistro: db.fecharegistro !== undefined ? db.fecharegistro : (db.fechaRegistro || new Date().toISOString().split('T')[0]),
    reservationType: db.reservation_type || 'hospedaje'
  } as any;
}


/**
 * Sincroniza los detalles estructurados complementarios de una propiedad (casa/departamento)
 * en la tabla property_details de Supabase
 */
export async function syncPropertyDetailsToSupabase(hotel: Hotel): Promise<{ success: boolean; error?: string }> {
  try {
    if (!hotel.tipoEstablecimiento || hotel.tipoEstablecimiento === 'hotel') {
      return { success: true }; // No requiere property_details relacionales
    }

    const payload = {
      id: `pd_${hotel.id}`,
      hotel_id: hotel.id,
      property_type: hotel.tipoEstablecimiento,
      listing_type: hotel.finalidad || 'alquiler',
      bedrooms: hotel.detallesInmueble?.habitaciones || 0,
      bathrooms: hotel.detallesInmueble?.banos || 0,
      square_meters: hotel.detallesInmueble?.metrosCuadrados || 0,
      furnished: !!hotel.detallesInmueble?.amueblado,
      parking: !!hotel.detallesInmueble?.tieneEstacionamiento,
      owner_name: hotel.propietario?.nombre || null,
      owner_phone: hotel.propietario?.telefono || null,
      owner_email: hotel.propietario?.email || null,
      owner_document: hotel.propietario?.documento || null,
      price: hotel.detallesInmueble?.precio || 0
    };

    const { error } = await supabase
      .from('property_details')
      .upsert(payload);

    if (error) {
      console.warn('Supabase syncPropertyDetailsToSupabase error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function syncHotelToSupabase(hotel: Hotel): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('hotels')
      .upsert(mapHotelToDb(hotel));

    if (error) {
      console.warn('Supabase syncHotel error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single room to Supabase
 */
export async function syncRoomToSupabase(room: Room): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('rooms')
      .upsert(mapRoomToDb(room));

    if (error) {
      console.warn('Supabase syncRoom error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single user to Supabase
 */
export async function syncUserToSupabase(user: User): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if there is an active session on the client side.
    // If there is no session (e.g. anonymous user signing up with email confirmation required),
    // we cannot write to public.users via the client anyway (RLS will block it).
    // The Postgres SECURITY DEFINER trigger handle_new_user() automatically inserts the profile on signup.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('Skipping manual user sync: no active session (will be handled by Postgres trigger).');
      return { success: true };
    }

    const payload = mapUserToDb(user);
    
    // Check if the user already exists in the database.
    // If the active client has no select permissions on this user, maybeSingle() returns null data safely.
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (checkError) {
      console.warn('Error checking user existence in Supabase:', checkError);
    }

    if (existingUser) {
      // Existing User: Perform update
      const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', user.id);

      if (error) {
        console.warn('Supabase updateUser error:', error);
        
        // If error is code 42703 (undefined_column) or mentions column/debecambiarpassword
        if (error.code === '42703' || error.message?.includes('debecambiarpassword') || error.message?.includes('column')) {
          console.log('Retrying user update without optional column "debecambiarpassword" to prevent Postgres schema errors...');
          delete payload.debecambiarpassword;
          
          const { error: retryErr } = await supabase
            .from('users')
            .update(payload)
            .eq('id', user.id);
            
          if (retryErr) {
            console.warn('Retry updateUser also failed:', retryErr);
            return { success: false, error: retryErr.message };
          }
          return { success: true };
        }
        
        return { success: false, error: error.message };
      }
    } else {
      // New User: Perform clean insert
      const { error } = await supabase
        .from('users')
        .insert(payload);

      if (error) {
        console.warn('Supabase insertUser error:', error);
        
        // If error is code 42703 (undefined_column) or mentions column/debecambiarpassword
        if (error.code === '42703' || error.message?.includes('debecambiarpassword') || error.message?.includes('column')) {
          console.log('Retrying user insert without optional column "debecambiarpassword" to prevent Postgres schema errors...');
          delete payload.debecambiarpassword;
          
          const { error: retryErr } = await supabase
            .from('users')
            .insert(payload);
            
          if (retryErr) {
            console.warn('Retry insertUser also failed:', retryErr);
            return { success: false, error: retryErr.message };
          }
          return { success: true };
        }
        
        return { success: false, error: error.message };
      }
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single reservation to Supabase
 */
export async function syncReservationToSupabase(res: Reservation): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reservations')
      .upsert(mapReservationToDb(res));

    if (error) {
      console.warn('Supabase syncReservation error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Uploads/Syncs a single audit log to Supabase
 */
export async function syncLogToSupabase(log: ActivityLog): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('logs')
      .upsert({
        id: log.id,
        timestamp: log.timestamp,
        user: log.user,
        role: log.role,
        action: log.action,
        detalles: log.detalles
      });

    if (error) {
      console.warn('Supabase syncLog error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Deletes a row in Supabase
 */
export async function deleteRowFromSupabase(table: 'hotels' | 'rooms' | 'users' | 'reservations' | 'logs' | 'messages' | 'transactions', id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.warn(`Supabase delete from ${table} error:`, error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export function mapChatMessageToDb(msg: ChatMessage): any {
  return {
    id: msg.id,
    senderid: msg.senderId,
    sendername: msg.senderName,
    senderrole: msg.senderRole,
    hotelid: msg.hotelId,
    text: msg.text,
    timestamp: msg.timestamp,
    read: msg.read
  };
}

export function mapChatMessageFromDb(db: any): ChatMessage {
  if (!db) return db;
  return {
    id: db.id,
    senderId: db.senderid !== undefined ? db.senderid : (db.senderId || ''),
    senderName: db.sendername !== undefined ? db.sendername : (db.senderName || ''),
    senderRole: db.senderrole !== undefined ? db.senderrole : (db.senderRole || 'cliente'),
    hotelId: db.hotelid !== undefined ? db.hotelid : (db.hotelId || ''),
    text: db.text || '',
    timestamp: db.timestamp || '',
    read: db.read !== undefined ? db.read : false
  };
}

export function mapPaymentTransactionToDb(tx: PaymentTransaction): any {
  return {
    id: tx.id,
    reservationid: tx.reservationId,
    amount: tx.amount,
    currency: tx.currency,
    paymentmethod: tx.paymentMethod,
    status: tx.status,
    reference: tx.reference,
    fecha: tx.fecha
  };
}

export function mapPaymentTransactionFromDb(db: any): PaymentTransaction {
  if (!db) return db;
  return {
    id: db.id,
    reservationId: db.reservationid !== undefined ? db.reservationid : (db.reservationId || ''),
    amount: Number(db.amount || 0),
    currency: db.currency || 'USD',
    paymentMethod: db.paymentmethod !== undefined ? db.paymentmethod : (db.paymentMethod || ''),
    status: db.status || 'completado',
    reference: db.reference || '',
    fecha: db.fecha || ''
  };
}

export async function syncChatMessageToSupabase(msg: ChatMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('messages')
      .upsert(mapChatMessageToDb(msg));
    if (error) {
      console.warn('Supabase syncChatMessage error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function syncPaymentTransactionToSupabase(tx: PaymentTransaction): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('transactions')
      .upsert(mapPaymentTransactionToDb(tx));
    if (error) {
      console.warn('Supabase syncPaymentTransaction error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Recupera todos los registros de la tabla property_details para auditoría y diagnóstico sin mutar la BD actual
 */
export async function fetchPropertyDetails(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('property_details')
      .select('*');
    if (error) {
      // Retornar error de forma controlada (p. ej. si la tabla no existe aún)
      return { success: false, error: error.message };
    }
    return { success: true, data: data };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Maps a local Review structure to its Database payload equivalent
 */
export function mapReviewToDb(review: Review): any {
  return {
    id: review.id,
    reservation_id: review.reservationId,
    hotel_id: review.hotelId,
    guest_id: review.guestId,
    rating: review.rating,
    comentario: review.comentario,
    fecha: review.fecha,
    user_name: review.isAnonymous ? 'Anónimo' : (review.userName || '')
  };
}

/**
 * Maps a Database review row to its application Review structure
 */
export function mapReviewFromDb(db: any): Review {
  if (!db) return db;
  const uName = db.user_name !== undefined ? db.user_name : (db.userName || '');
  return {
    id: db.id,
    reservationId: db.reservation_id !== undefined ? db.reservation_id : (db.reservationId || ''),
    hotelId: db.hotel_id !== undefined ? db.hotel_id : (db.hotelId || ''),
    guestId: db.guest_id !== undefined ? db.guest_id : (db.guestId || ''),
    rating: Number(db.rating || 0),
    comentario: db.comentario || '',
    fecha: db.fecha || '',
    userName: uName,
    isAnonymous: db.is_anonymous !== undefined ? db.is_anonymous : (uName === 'Anónimo' || db.isAnonymous === true)
  };
}

/**
 * Uploads/Syncs a single Review to the Supabase database
 */
export async function syncReviewToSupabase(review: Review): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reviews')
      .upsert(mapReviewToDb(review));

    if (error) {
      console.warn('Supabase syncReview error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Maps a local RoomPriceVariation structure to its Database payload equivalent
 */
export function mapRoomPriceVariationToDb(v: RoomPriceVariation): any {
  return {
    id: v.id,
    room_id: v.roomId,
    hotel_id: v.hotelId,
    fecha: v.fecha || null,
    is_weekend: v.isWeekend,
    precio: v.precio,
    motivo: v.motivo || ''
  };
}

/**
 * Maps a Database row to its application RoomPriceVariation structure
 */
export function mapRoomPriceVariationFromDb(db: any): RoomPriceVariation {
  if (!db) return db;
  return {
    id: db.id,
    roomId: db.room_id !== undefined ? db.room_id : (db.roomId || ''),
    hotelId: db.hotel_id !== undefined ? db.hotel_id : (db.hotelId || ''),
    fecha: db.fecha || null,
    isWeekend: db.is_weekend !== undefined ? db.is_weekend : (db.isWeekend || false),
    precio: Number(db.precio || 0),
    motivo: db.motivo || ''
  };
}

/**
 * Syncs/Upserts a single RoomPriceVariation to Supabase
 */
export async function syncRoomPriceVariationToSupabase(v: RoomPriceVariation): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('room_price_variations')
      .upsert(mapRoomPriceVariationToDb(v));

    if (error) {
      console.warn('Supabase syncRoomPriceVariation error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Deletes a single RoomPriceVariation from Supabase
 */
export async function deleteRoomPriceVariationFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('room_price_variations')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase deleteRoomPriceVariation error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

