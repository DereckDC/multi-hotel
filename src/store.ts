/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { getSocket } from './services/socket';
import { sortMessagesChronologically } from './utils/chatUtils';
import { Hotel, Room, User, Reservation, RoomStatus, ReservationStatus, UserRole, ChatMessage, PaymentTransaction, Review, RoomPriceVariation, IcalFeed, ExternalBlock } from './types';
import {
  supabase,
  syncHotelToSupabase,
  syncRoomToSupabase,
  syncUserToSupabase,
  syncReservationToSupabase,
  syncLogToSupabase,
  deleteRowFromSupabase,
  mapHotelFromDb,
  mapHotelToDb,
  mapRoomFromDb,
  mapRoomToDb,
  mapUserFromDb,
  mapUserToDb,
  mapReservationFromDb,
  mapReservationToDb,
  syncChatMessageToSupabase,
  syncPaymentTransactionToSupabase,
  mapChatMessageFromDb,
  mapPaymentTransactionFromDb,
  syncPropertyDetailsToSupabase,
  mapReviewFromDb,
  syncReviewToSupabase,
  mapRoomPriceVariationFromDb,
  syncRoomPriceVariationToSupabase,
  deleteRoomPriceVariationFromSupabase,
  fetchBusyRanges,
  fetchIcalFeeds,
  fetchExternalBlocks
} from './supabase';

// Los enlaces de los correos van siempre al sitio real (PRODUCTION_ORIGIN), aunque el correo
// salga de una prueba en localhost o del APK: quien lo abre está fuera de esa sesión.
import { isNativeApp, PRODUCTION_ORIGIN } from './utils/platform';
import { removeStoredImages, storedImagesOf, unusedImages } from './utils/images';
import { notify } from './utils/notify';
import { friendlyError } from './utils/errors';
import { procesarFacturaDeReserva } from './utils/sriApi';
import { emailSubject, renderBrandEmail, renderBrandText, type BrandEmail } from '../supabase/functions/_shared/brandEmail.ts';

const money = (n: number | undefined) => `$${Number(n || 0).toFixed(2)} USD`;

/** Contacto del establecimiento para el pie de los correos (solo lo que exista) */
const hotelContactLine = (hotel?: Hotel) => {
  const parts = [hotel?.contacto?.telefono, hotel?.contacto?.email].filter(Boolean);
  return parts.length ? `${hotel?.nombre || 'El establecimiento'}: ${parts.join(' · ')}` : undefined;
};

// Safe standard local storage storage key constants
const STORAGE_PREFIX = 'aura_hotel_pms_';

// Resolve appropriate API Base URL for Web (Vercel, Cloud Run, Local) and Mobile (Capacitor/WebView)
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    // Mobile Capacitor / WebView environment: el origen interno (https://localhost) no sirve el API, se usa producción
    if (isNativeApp()) {
      try {
        const saved = localStorage.getItem('roomia_api_origin');
        if (saved && saved !== origin && /^https?:\/\//.test(saved) && !/\/\/localhost(:|\/|$)/.test(saved) && !/^https:\/\/roomiapms\.site\/?$/.test(saved)) return saved;
      } catch (e) {}
      return PRODUCTION_ORIGIN;
    }
    // Web environments (Vercel, Localhost, Cloud Run, Custom Domains)
    try {
      localStorage.setItem('roomia_api_origin', origin);
    } catch (e) {}
    return origin;
  }
  return '';
}
const KEYS = {
  HOTELS: `${STORAGE_PREFIX}hotels`,
  ROOMS: `${STORAGE_PREFIX}rooms`,
  USERS: `${STORAGE_PREFIX}users`,
  RESERVATIONS: `${STORAGE_PREFIX}reservations`,
  CURRENT_USER_ID: `${STORAGE_PREFIX}current_user_id`,
  LOGS: `${STORAGE_PREFIX}logs`
};

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  detalles: string;
}

export function compressImage(base64: string, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image')) {
      resolve(base64);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      try {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length < base64.length) {
          resolve(compressed);
        } else {
          resolve(base64);
        }
      } catch (e) {
        resolve(base64);
      }
    };
    img.onerror = () => {
      resolve(base64);
    };
    img.src = base64;
  });
}

export function getCookie(name: string): string | null {
  try {
    const nameEQ = encodeURIComponent(name) + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
    }
  } catch (e) {
    console.warn('Cookie get error:', e);
  }
  return null;
}

export function setCookie(name: string, value: string, days = 7): void {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn('Cookie set error:', e);
  }
}

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  // 1. Try LocalStorage
  try {
    const item = localStorage.getItem(key);
    if (item) {
      const parsed = JSON.parse(item);
      if (parsed !== null && parsed !== undefined) return parsed;
    }
  } catch (error) {
    console.warn('LocalStorage load warning for key:', key, error);
  }

  // 2. Fallback to Cookie storage
  try {
    const cookieVal = getCookie(key);
    if (cookieVal) {
      const parsed = JSON.parse(cookieVal);
      if (parsed !== null && parsed !== undefined) return parsed;
    }
  } catch (cookieErr) {
    console.warn('Cookie load warning for key:', key, cookieErr);
  }

  return defaultValue;
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    let processedValue: any = value;
    
    // Aggressively thin out any massive base64 strings in rooms or hotels before saving to localStorage / cookies
    if (key === KEYS.ROOMS && Array.isArray(value)) {
      processedValue = (value as any[]).map(room => {
        if (room.imagenes && room.imagenes.length > 0) {
          return {
            ...room,
            // Keep at most 1 image, and strip it or truncate it if it's way too big
            imagenes: room.imagenes.slice(0, 1).map((img: string) => {
              if (img && img.startsWith('data:image') && img.length > 20000) {
                return img.slice(0, 20000) + '...'; 
              }
              return img;
            })
          };
        }
        return room;
      });
    } else if (key === KEYS.HOTELS && Array.isArray(value)) {
      processedValue = (value as any[]).map(hotel => {
        return {
          ...hotel,
          imagenes: hotel.imagenes ? hotel.imagenes.slice(0, 1).map((img: string) => {
            if (img && img.startsWith('data:image') && img.length > 20000) {
              return img.slice(0, 20000) + '...';
            }
            return img;
          }) : [],
          logo: hotel.logo && hotel.logo.startsWith('data:image') && hotel.logo.length > 20000 ? hotel.logo.slice(0, 20000) + '...' : hotel.logo,
          portada: hotel.portada && hotel.portada.startsWith('data:image') && hotel.portada.length > 20000 ? hotel.portada.slice(0, 20000) + '...' : hotel.portada
        };
      });
    }

    const payload = JSON.stringify(processedValue);

    // Primary: Write to LocalStorage
    try {
      localStorage.setItem(key, payload);
    } catch (error: any) {
      console.warn('LocalStorage caught block for key:', key, error.message || error);
      
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 1014 || (error.message && error.message.includes('quota'))) {
        try {
          const keysToRemove = [
            `${STORAGE_PREFIX}logs`,
            `${STORAGE_PREFIX}deleted_res_ids`,
            'messages',
            'transactions',
            'reviews',
            'roomPriceVariations',
            'roomia_api_origin'
          ];
          for (const k of keysToRemove) {
            try { localStorage.removeItem(k); } catch (e) {}
          }

          let bareValue = value;
          if (key === KEYS.ROOMS && Array.isArray(value)) {
            bareValue = (value as any[]).map(room => ({ ...room, imagenes: [] })) as unknown as T;
          } else if (key === KEYS.HOTELS && Array.isArray(value)) {
            bareValue = (value as any[]).map(hotel => ({ ...hotel, imagenes: [], logo: '', portada: '' })) as unknown as T;
          }
          
          localStorage.setItem(key, JSON.stringify(bareValue));
        } catch (finalError) {
          console.warn('LocalStorage completely locked, clearing non-essentials:', finalError);
        }
      }
    }

    // Secondary / Fallback: Keep Cookie synchronized
    try {
      if (payload.length < 3500) {
        setCookie(key, payload, 7);
      } else {
        let condensed = processedValue;
        if (Array.isArray(processedValue)) {
          condensed = processedValue.map((item: any) => ({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio || item.detallesInmueble?.precio,
            ciudad: item.ciudad || item.contacto?.ciudad,
            estado: item.estado,
            hotelId: item.hotelId
          }));
        }
        const condensedPayload = JSON.stringify(condensed);
        if (condensedPayload.length < 3800) {
          setCookie(key, condensedPayload, 7);
        }
      }
    } catch (cookieErr) {
      console.warn('Cookie sync warning for key:', key, cookieErr);
    }

  } catch (error: any) {
    console.warn('Storage save exception for key:', key, error);
  }
}

/** Del propietario solo se guarda en el catálogo lo público (nombre y teléfono). Correo y cédula van aparte. */
const publicOwner = (p: Hotel['propietario']): Hotel['propietario'] =>
  p ? { nombre: p.nombre || '', telefono: p.telefono || '' } : p;

export const sanitizeHotels = (list: Hotel[]): Hotel[] => {
  return (list || []).map(h => ({
    ...h,
    propietario: publicOwner(h.propietario),
    serviciosDetallados: h.serviciosDetallados || []
  }));
};

/** Datos privados del propietario (tabla hotel_owners): solo los leen superadmin y admin de hotel */
export interface HotelOwnerPrivate {
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
}

export function useHotelStore() {
  const [hotels, setHotels] = useState<Hotel[]>(() => sanitizeHotels(loadFromLocalStorage(KEYS.HOTELS, [])));
  const [rooms, setRooms] = useState<Room[]>(() => loadFromLocalStorage(KEYS.ROOMS, []));
  const [users, setUsers] = useState<User[]>(() => loadFromLocalStorage(KEYS.USERS, []));
  const [reservations, setReservations] = useState<Reservation[]>(() => loadFromLocalStorage(KEYS.RESERVATIONS, []));
  const [currentUserId, setCurrentUserId] = useState<string>(() => loadFromLocalStorage(KEYS.CURRENT_USER_ID, ''));
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
  const [logs, setLogs] = useState<ActivityLog[]>(() => loadFromLocalStorage(KEYS.LOGS, []));
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadFromLocalStorage('messages', []));
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() => loadFromLocalStorage('transactions', []));
  const [reviews, setReviews] = useState<Review[]>(() => loadFromLocalStorage('reviews', []));
  const [roomPriceVariations, setRoomPriceVariations] = useState<RoomPriceVariation[]>(() => loadFromLocalStorage('roomPriceVariations', []));

  // Sync to local storage
  useEffect(() => { saveToLocalStorage(KEYS.HOTELS, hotels); }, [hotels]);
  useEffect(() => { saveToLocalStorage(KEYS.ROOMS, rooms); }, [rooms]);
  useEffect(() => { saveToLocalStorage(KEYS.USERS, users); }, [users]);
  useEffect(() => { saveToLocalStorage(KEYS.RESERVATIONS, reservations); }, [reservations]);
  useEffect(() => { saveToLocalStorage(KEYS.CURRENT_USER_ID, currentUserId); }, [currentUserId]);
  useEffect(() => { saveToLocalStorage(KEYS.LOGS, logs); }, [logs]);
  useEffect(() => { saveToLocalStorage('messages', messages); }, [messages]);
  useEffect(() => { saveToLocalStorage('transactions', transactions); }, [transactions]);
  useEffect(() => { saveToLocalStorage('reviews', reviews); }, [reviews]);
  useEffect(() => { saveToLocalStorage('roomPriceVariations', roomPriceVariations); }, [roomPriceVariations]);

  // Watchdog automático para expirar reservaciones pendientes que excedan 24 horas sin pago
  const reservationsRef = useRef(reservations);
  useEffect(() => { reservationsRef.current = reservations; }, [reservations]);
  const roomsRef = useRef(rooms);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  useEffect(() => {
    const sweepExpiredReservations = async () => {
      const currentReservations = reservationsRef.current;
      if (!currentReservations || currentReservations.length === 0) return;

      const now = new Date();
      let hasChanges = false;

      const updatedReservations = await Promise.all(
        currentReservations.map(async (res) => {
          if (res.estado !== 'pendiente') return res;

          let createdTime: Date;
          if (res.fechaRegistroTimestamp) {
            createdTime = new Date(res.fechaRegistroTimestamp);
          } else {
            // Fallback: usar fecha sin hora (interpretado a inicio del día)
            createdTime = new Date(res.fechaRegistro + 'T00:00:00');
          }

          const diffMs = now.getTime() - createdTime.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours >= 24) {
            hasChanges = true;
            const cancelledRes: Reservation = {
              ...res,
              estado: 'cancelada',
              mensajeCambio: 'Reservación cancelada de forma automática por el sistema al expirar el límite de 24 horas para reportar el pago.',
              fechaCambio: new Date().toISOString(),
              modificadoPor: 'Roomia PMS'
            };

            try {
              await syncReservationToSupabase(cancelledRes);
              const targetRoom = roomsRef.current.find(r => r.id === res.roomId);
              if (targetRoom) {
                await syncRoomToSupabase({ ...targetRoom, estado: 'disponible' });
              }
            } catch (syncErr) {
              console.warn("Watchdog sync error:", syncErr);
            }

            addLog(
              'Watchdog Automático',
              'super_admin',
              'Expiración de Reserva',
              `La reservación pendiente ${res.id} fue liberada automáticamente y pasó a estado disponible, por expirar el plazo de pago de 24 horas.`
            );

            // Actualizar localmente el estado de la habitación
            setRooms(prev => prev.map(r => r.id === res.roomId ? { ...r, estado: 'disponible' } : r));

            return cancelledRes;
          }

          return res;
        })
      );

      if (hasChanges) {
        setReservations(updatedReservations);
      }
    };

    // Ejecutar de forma diferida tras cargar datos, y re-evaluar cada 1 minuto (60s)
    const timeout = setTimeout(sweepExpiredReservations, 5000);
    const interval = setInterval(sweepExpiredReservations, 60000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  // Synchronize with Supabase database on mount and listen to changes
  useEffect(() => {
    const fetchSupabaseData = async () => {
      // Prioritize public catalog fetch to minimize LCP & Critical Path Latency
      const catalogPromise = Promise.allSettled([
        supabase.from('hotels').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('reviews').select('*'),
        supabase.from('room_price_variations').select('*')
      ]).then(([hotelsRes, roomsRes, reviewsRes, variationsRes]) => {
        if (hotelsRes.status === 'fulfilled' && hotelsRes.value.data) {
          const mappedHotels = hotelsRes.value.data.map(mapHotelFromDb).filter(Boolean) as Hotel[];
          setHotels(sanitizeHotels(mappedHotels));
        }

        if (roomsRes.status === 'fulfilled' && roomsRes.value.data) {
          const mappedRooms = roomsRes.value.data.map(mapRoomFromDb).filter(Boolean) as Room[];
          setRooms(mappedRooms);
        }
        if (reviewsRes.status === 'fulfilled' && reviewsRes.value.data) {
          setReviews(reviewsRes.value.data.map(mapReviewFromDb).filter(Boolean) as Review[]);
        }
        if (variationsRes.status === 'fulfilled' && variationsRes.value.data) {
          setRoomPriceVariations(variationsRes.value.data.map(mapRoomPriceVariationFromDb).filter(Boolean) as RoomPriceVariation[]);
        }
        // Unlock public catalog view immediately for ultra-fast LCP (< 500ms)
        setIsInitialSyncing(false);
      }).catch(err => {
        console.warn("Catalog fetch exception:", err);
        setIsInitialSyncing(false);
      });

      // Concurrently check session without blocking the critical catalog render
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setCurrentUserId(session.user.id);
        } else {
          const savedId = loadFromLocalStorage(KEYS.CURRENT_USER_ID, '');
          if (savedId) {
            setCurrentUserId(savedId);
          }
        }
      }).catch(e => {
        console.warn("Session check exception:", e);
      });

      // Background parallel fetch for admin & operational tables without delaying LCP
      Promise.allSettled([
        supabase.from('users').select('*'),
        supabase.from('reservations').select('*'),
        supabase.from('logs').select('*'),
        supabase.from('messages').select('*'),
        supabase.from('transactions').select('*')
      ]).then(([usersRes, resRes, logsRes, msgRes, txRes]) => {
        if (usersRes.status === 'fulfilled' && usersRes.value.data) {
          const mappedUsers = usersRes.value.data.map(mapUserFromDb).filter(Boolean) as User[];
          setUsers(mappedUsers);
        }

        if (resRes.status === 'fulfilled' && resRes.value.data) {
          const mappedRes = resRes.value.data.map(mapReservationFromDb).filter(Boolean) as Reservation[];
          setReservations(mappedRes);
        }

        if (logsRes.status === 'fulfilled' && logsRes.value.data) {
          const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const filteredLogs = (logsRes.value.data as ActivityLog[]).filter(log => log.timestamp >= cutoff30d);
          setLogs(filteredLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
        }

        if (msgRes.status === 'fulfilled' && msgRes.value.data) {
          const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const mappedMsgs = msgRes.value.data.map(mapChatMessageFromDb).filter(Boolean) as ChatMessage[];
          const filteredMsgs = mappedMsgs.filter(msg => msg.timestamp >= cutoff24h);
          setMessages(sortMessagesChronologically(filteredMsgs));
        }

        if (txRes.status === 'fulfilled' && txRes.value.data) {
          setTransactions(txRes.value.data.map(mapPaymentTransactionFromDb).filter(Boolean) as PaymentTransaction[]);
        }
      }).catch(err => {
        console.warn("Background tables sync exception:", err);
      });

      // Safety timeout to guarantee isInitialSyncing is cleared even in network timeouts
      setTimeout(() => setIsInitialSyncing(false), 2000);
      await catalogPromise;
    };

    fetchSupabaseData();

    // WebSocket real-time listener for instant bidirectional chat updates without page refresh
    let socket = getSocket();
    if (socket) {
      socket.on('chat:message', (incomingMsg: ChatMessage) => {
        if (!incomingMsg || !incomingMsg.id) return;
        setMessages(prev => {
          if (prev.some(m => m.id === incomingMsg.id)) return prev;
          return sortMessagesChronologically([...prev, incomingMsg]);
        });
      });

      socket.on('chat:read', (payload: { hotelId: string; senderId?: string; senderRole?: UserRole; targetCustomerId?: string; isClientReading?: boolean }) => {
        if (!payload || !payload.hotelId) return;
        setMessages(prev => prev.map(m => {
          if (m.hotelId !== payload.hotelId) return m;

          if (payload.isClientReading || payload.senderRole === 'cliente') {
            const cId = payload.senderId;
            if ((m.recipientId === cId || m.customerId === cId) && m.senderRole !== 'cliente') {
              return { ...m, read: true };
            }
          }

          if (payload.targetCustomerId) {
            if (m.senderId === payload.targetCustomerId && m.senderRole === 'cliente') {
              return { ...m, read: true };
            }
          }

          if (payload.senderId && payload.senderRole && m.senderId === payload.senderId && m.senderRole === payload.senderRole) {
            return { ...m, read: true };
          }

          return m;
        }));
      });
    }

    // Helper for refreshing messages in real-time as fallback
    const refreshMessagesInStore = async () => {
      try {
        const { data } = await supabase.from('messages').select('*');
        if (data) {
          const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const mappedMsgs = data.map(mapChatMessageFromDb).filter(Boolean) as ChatMessage[];
          const filteredMsgs = mappedMsgs.filter(msg => msg.timestamp >= cutoff24h);
          const sorted = sortMessagesChronologically(filteredMsgs);
          setMessages(prev => {
            if (prev.length === sorted.length && prev.every((m, idx) => m.id === sorted[idx]?.id && m.read === sorted[idx]?.read)) {
              return prev;
            }
            return sorted;
          });
        }
      } catch (e) {
        // Silent catch for network hiccups
      }
    };

    // Lightweight fallback polling interval for messages when tab is active
    const msgInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshMessagesInStore();
      }
    }, 20000);

    // BroadcastChannel listener for instant cross-tab sync
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('roomia_live_chat_sync');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'CHAT_MSG') {
            refreshMessagesInStore();
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }

    // Subscribe to real-time Postgres changes for real multi-tab / synchronized state
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotels' }, async () => {
        const { data } = await supabase.from('hotels').select('*');
        if (data) setHotels(sanitizeHotels(data.map(mapHotelFromDb).filter(Boolean) as Hotel[]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, async () => {
        const { data } = await supabase.from('rooms').select('*');
        if (data) setRooms(data.map(mapRoomFromDb).filter(Boolean) as Room[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async () => {
        const { data } = await supabase.from('users').select('*');
        if (data) setUsers(data.map(mapUserFromDb).filter(Boolean) as User[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, async () => {
        const { data } = await supabase.from('reservations').select('*');
        if (data) setReservations(data.map(mapReservationFromDb).filter(Boolean) as Reservation[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, async () => {
        const { data } = await supabase.from('logs').select('*');
        if (data) {
          const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const filteredLogs = (data as ActivityLog[]).filter(log => log.timestamp >= cutoff30d);
          const sorted = filteredLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          setLogs(sorted);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        refreshMessagesInStore();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async () => {
        const { data } = await supabase.from('transactions').select('*');
        if (data) setTransactions(data.map(mapPaymentTransactionFromDb).filter(Boolean) as PaymentTransaction[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, async () => {
        const { data } = await supabase.from('reviews').select('*');
        if (data) setReviews(data.map(mapReviewFromDb).filter(Boolean) as Review[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_price_variations' }, async () => {
        const { data } = await supabase.from('room_price_variations').select('*');
        if (data) setRoomPriceVariations(data.map(mapRoomPriceVariationFromDb).filter(Boolean) as RoomPriceVariation[]);
      })
      .subscribe();

    return () => {
      clearInterval(msgInterval);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const activeUser = currentUserId
    ? (users && users.find(u => u && u.id === currentUserId)) || null
    : null;

  // --- DATOS PRIVADOS DEL PROPIETARIO ---
  // Correo y cédula del propietario están en hotel_owners, que solo pueden leer superadmin y
  // admin de hotel. Se combinan con el catálogo en memoria y nunca se guardan en localStorage.
  const [hotelOwners, setHotelOwners] = useState<Record<string, HotelOwnerPrivate>>({});
  const canSeeOwners = activeUser?.rol === 'super_admin' || activeUser?.rol === 'hotel_admin';

  const loadHotelOwners = async () => {
    const { data, error } = await supabase.from('hotel_owners').select('hotel_id, nombre, telefono, email, documento');
    if (error) {
      console.warn('No se pudieron cargar los datos privados de propietarios:', error.message);
      return;
    }
    const map: Record<string, HotelOwnerPrivate> = {};
    (data || []).forEach((o: any) => { map[o.hotel_id] = { nombre: o.nombre, telefono: o.telefono, email: o.email, documento: o.documento }; });
    setHotelOwners(map);
  };

  useEffect(() => {
    if (canSeeOwners) loadHotelOwners();
    else setHotelOwners({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeOwners, currentUserId]);

  const hotelsWithOwners = useMemo(() => {
    if (!canSeeOwners) return hotels;
    return hotels.map(h => {
      const o = hotelOwners[h.id];
      if (!o) return h;
      return {
        ...h,
        propietario: {
          nombre: h.propietario?.nombre || o.nombre || '',
          telefono: h.propietario?.telefono || o.telefono || '',
          email: o.email || '',
          documento: o.documento || ''
        }
      };
    });
  }, [hotels, hotelOwners, canSeeOwners]);

  // --- DISPONIBILIDAD DE TERCEROS (sin datos personales) ---
  // El personal ve todas las reservas. Un huésped o un visitante solo puede leer las
  // suyas, así que la ocupación del resto llega como rangos anónimos desde
  // get_busy_ranges() y se añade a la lista que usan los calendarios y la validación.
  const isStaffSession = !!activeUser && activeUser.rol !== 'cliente';
  const [busyRanges, setBusyRanges] = useState<Reservation[]>([]);

  useEffect(() => {
    if (isStaffSession) {
      setBusyRanges([]);
      return;
    }

    let cancelled = false;
    const loadBusyRanges = async () => {
      const ranges = await fetchBusyRanges();
      if (!cancelled && ranges) {
        setBusyRanges(ranges);
      }
    };

    loadBusyRanges();
    const busyInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        loadBusyRanges();
      }
    }, 60000);
    const onRefreshRequested = () => { loadBusyRanges(); };
    window.addEventListener('roomia-refresh-busy', onRefreshRequested);

    return () => {
      cancelled = true;
      clearInterval(busyInterval);
      window.removeEventListener('roomia-refresh-busy', onRefreshRequested);
    };
  }, [currentUserId, isStaffSession]);

  // --- CALENDARIOS iCAL (Airbnb / Booking) ---
  // El personal ve los bloqueos importados (con su plataforma) y los admins además gestionan las
  // conexiones. No se mezclan con `reservations`: no son reservas y falsearían ingresos y estadísticas.
  // Los huéspedes los reciben ya incluidos en los rangos ocupados anónimos (get_busy_ranges).
  const [icalFeeds, setIcalFeeds] = useState<IcalFeed[]>([]);
  const [externalBlocks, setExternalBlocks] = useState<ExternalBlock[]>([]);
  const canManageIcal = !!activeUser && (activeUser.rol === 'super_admin' || activeUser.rol === 'hotel_admin');

  const refreshIcal = async () => {
    if (!isStaffSession) return;
    const blocks = await fetchExternalBlocks();
    if (blocks) setExternalBlocks(blocks);
    if (canManageIcal) {
      const feeds = await fetchIcalFeeds();
      if (feeds) setIcalFeeds(feeds);
    }
  };
  const refreshIcalRef = useRef(refreshIcal);
  refreshIcalRef.current = refreshIcal;

  useEffect(() => {
    if (!isStaffSession) {
      setExternalBlocks([]);
      setIcalFeeds([]);
      return;
    }

    refreshIcalRef.current();
    const channel = supabase
      .channel('ical-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_blocks' }, () => refreshIcalRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ical_feeds' }, () => refreshIcalRef.current())
      .subscribe();
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refreshIcalRef.current();
      }
    }, 120000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isStaffSession, canManageIcal]);

  const reservationsWithBusy = useMemo(() => {
    if (isStaffSession || busyRanges.length === 0) return reservations;
    const rangeKey = (r: Reservation) => `${r.roomId || ''}|${r.hotelId}|${r.fechaEntrada}|${r.fechaSalida}`;
    const alreadyKnown = new Set(
      reservations
        .filter(r => r.estado !== 'cancelada' && r.estado !== 'finalizada')
        .map(rangeKey)
    );
    const extra = busyRanges.filter(b => !alreadyKnown.has(rangeKey(b)));
    return extra.length > 0 ? [...reservations, ...extra] : reservations;
  }, [reservations, busyRanges, isStaffSession]);

  const addLog = async (user: string, role: string, action: string, detalles: string) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      role,
      action,
      detalles
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50)); // Limit to last 50 logs

    try {
      await syncLogToSupabase(newLog);
    } catch (supabaseErr) {
      console.warn("Silent Supabase log sync error:", supabaseErr);
    }
  };

  // Switch active session on login
  const switchSessionUser = (userId: string, fetchedUser?: User) => {
    if (userId === currentUserId && !fetchedUser) {
      return;
    }
    if (fetchedUser) {
      setUsers(prev => {
        const cleanPrev = (prev || []).filter(Boolean);
        const index = cleanPrev.findIndex(u => u.id === fetchedUser.id);
        if (index >= 0) {
          return cleanPrev.map(u => u.id === fetchedUser.id ? { ...u, ...fetchedUser } : u);
        }
        return [...cleanPrev, fetchedUser];
      });
    }
    const isNewUser = userId !== currentUserId;
    setCurrentUserId(userId);
    if (isNewUser) {
      const targetUser = fetchedUser || (users && users.find(u => u && u.id === userId));
      if (targetUser) {
        addLog(
          `${targetUser.nombre} ${targetUser.apellido}`,
          targetUser.rol,
          'Inicio de Sesión',
          `Sesión iniciada correctamente en la plataforma.`
        );
      }
    }
  };

  // Clear local session state
  const factoryResetAll = async () => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}deleted_res_ids`);
      localStorage.removeItem(KEYS.HOTELS);
      localStorage.removeItem(KEYS.ROOMS);
      localStorage.removeItem(KEYS.USERS);
      localStorage.removeItem(KEYS.RESERVATIONS);
      localStorage.removeItem(KEYS.CURRENT_USER_ID);
      localStorage.removeItem(KEYS.LOGS);
    } catch (e) {}
    setHotels([]);
    setRooms([]);
    setUsers([]);
    setReservations([]);
    setCurrentUserId('');
  };

  // --- CRUD HOTELS ---
  /**
   * Borra del almacenamiento fotos que ya no usa el registro editado o borrado, siempre que
   * ningún otro hotel, propiedad o habitación las siga usando.
   */
  const cleanupUnusedImages = (urls: string[], exceptId?: string) => {
    if (urls.length === 0) return;
    const inUse = new Set([
      ...hotels.filter(h => h.id !== exceptId).flatMap(h => storedImagesOf(h)),
      ...rooms.filter(r => r.id !== exceptId).flatMap(r => storedImagesOf(r))
    ]);
    const toRemove = urls.filter(u => !inUse.has(u));
    if (toRemove.length) removeStoredImages(toRemove);
  };

  const saveHotel = async (hotel: Hotel) => {
    const previousHotel = hotels.find(h => h.id === hotel.id);
    // En el catálogo solo queda lo público del propietario; correo y cédula, en hotelOwners
    const publicHotel: Hotel = { ...hotel, propietario: publicOwner(hotel.propietario) };
    setHotels(prev => {
      const exists = prev.some(h => h.id === hotel.id);
      if (exists) {
        return prev.map(h => h.id === hotel.id ? publicHotel : h);
      } else {
        return [...prev, publicHotel];
      }
    });
    if (hotel.propietario) {
      const p = hotel.propietario;
      // Igual que el trigger de la base: un valor vacío no borra el guardado
      setHotelOwners(prev => {
        const old = prev[hotel.id] || {};
        return {
          ...prev,
          [hotel.id]: {
            nombre: p.nombre?.trim() || old.nombre,
            telefono: p.telefono?.trim() || old.telefono,
            email: p.email?.trim() || old.email,
            documento: p.documento?.trim() || old.documento
          }
        };
      });
    }

    try {
      // Se envía completo: el trigger de la base separa lo privado en hotel_owners
      const syncRes = await syncHotelToSupabase(hotel);
      if (hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento') {
        await syncPropertyDetailsToSupabase(hotel);
      }

      if (!syncRes.success) {
        console.error("❌ Supabase syncHotel error detail:", syncRes.error);
        notify.warning('Guardamos los cambios en este dispositivo, pero aún no se sincronizaron. Revisa tu conexión e inténtalo de nuevo.');
      } else {
        // Fotos que la versión anterior usaba y esta ya no: se borran del almacenamiento
        cleanupUnusedImages(unusedImages(previousHotel, hotel), hotel.id);
        notify.success(`"${hotel.nombre}" se guardó correctamente.`);
      }
    } catch (err: any) {
      console.warn("Supabase saveHotel sync error:", err);
      notify.warning('Guardamos los cambios en este dispositivo, pero aún no se sincronizaron. Revisa tu conexión e inténtalo de nuevo.');
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Guardar Hotel',
      `Hotel "${hotel.nombre}" guardado/modificado satisfactoriamente`
    );
  };

  const deleteHotel = async (hotelId: string) => {
    const targetHotel = hotels.find(h => h.id === hotelId);
    
    // Find all rooms and users that belong to this hotel to delete or unlink
    const roomsToDelete = rooms.filter(r => r.hotelId === hotelId);
    const usersToUnlink = users.filter(u => u.hotelId === hotelId);

    // Update local state
    setHotels(prev => prev.filter(h => h.id !== hotelId));
    setRooms(prev => prev.filter(r => r.hotelId !== hotelId));
    setUsers(prev => prev.map(u => u.hotelId === hotelId ? { ...u, hotelId: undefined } : u));

    // Supabase delete hotel
    try {
      const del = await deleteRowFromSupabase('hotels', hotelId);
      // Fotos del hotel y de sus habitaciones (se borran con él en la base de datos)
      if (del.success) {
        cleanupUnusedImages([...storedImagesOf(targetHotel), ...roomsToDelete.flatMap(r => storedImagesOf(r))], hotelId);
      }
    } catch (err) {
      console.warn("Supabase deleteHotel error:", err);
    }

    // Supabase delete associated rooms
    for (const room of roomsToDelete) {
      try {
        await deleteRowFromSupabase('rooms', room.id);
      } catch (err) {
        console.warn(`Supabase deleteRoom for room ${room.id} failed:`, err);
      }
    }

    // Supabase unlink associated admins/receptionists
    for (const u of usersToUnlink) {
      const updatedUser = { ...u, hotelId: undefined };
      try {
        await syncUserToSupabase(updatedUser);
      } catch (err) {
        console.warn(`Supabase unlink user ${u.id} failed:`, err);
      }
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Eliminar Hotel',
      `Hotel "${targetHotel?.nombre || hotelId}" y todas sus habitaciones vinculadas eliminados permanente. El administrador y el recepcionista fueron liberados ("quedaron en libre").`
    );
  };

  // --- CRUD ROOMS ---
  const saveRoom = async (room: Room) => {
    const previousRoom = rooms.find(r => r.id === room.id);
    let validatedRoom = { ...room };
    if (!validatedRoom.hotelId && hotels.length > 0) {
      validatedRoom.hotelId = hotels[0].id;
    }

    setRooms(prev => {
      const exists = prev.some(r => r.id === validatedRoom.id);
      if (exists) {
        return prev.map(r => r.id === validatedRoom.id ? validatedRoom : r);
      } else {
        return [...prev, validatedRoom];
      }
    });

    try {
      const result = await syncRoomToSupabase(validatedRoom);
      if (!result.success) {
        console.error("❌ Error al guardar habitación en Supabase:", result.error);
        notify.warning(`La habitación N° ${validatedRoom.numero} se guardó en este dispositivo, pero aún no se sincronizó. Revisa tu conexión.`);
      } else {
        console.log("✅ Habitación guardada exitosamente en Supabase:", validatedRoom.id);
        cleanupUnusedImages(unusedImages(previousRoom, validatedRoom), validatedRoom.id);
        notify.success(`Habitación N° ${validatedRoom.numero} (${validatedRoom.nombre}) guardada correctamente.`);
      }
    } catch (err) {
      console.warn("Supabase saveRoom sync error:", err);
      notify.warning(`La habitación N° ${validatedRoom.numero} se guardó en este dispositivo, pero aún no se sincronizó. Revisa tu conexión.`);
    }

    const parentHotel = hotels.find(h => h.id === validatedRoom.hotelId);
    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Guardar Habitación',
      `Habitación N° ${validatedRoom.numero} (${validatedRoom.nombre}) en ${parentHotel?.nombre || 'hotel'} guardada.`
    );
  };

  const deleteRoom = async (roomId: string) => {
    const targetRoom = rooms.find(r => r.id === roomId);
    setRooms(prev => prev.filter(r => r.id !== roomId));

    try {
      const del = await deleteRowFromSupabase('rooms', roomId);
      if (del.success) cleanupUnusedImages(storedImagesOf(targetRoom), roomId);
      notify.success(`Habitación N° ${targetRoom?.numero || roomId} eliminada.`);
    } catch (err) {
      console.warn("Supabase deleteRoom error:", err);
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Eliminar Habitación',
      `Habitación N° ${targetRoom?.numero || roomId} borrada del sistema.`
    );
  };

  // --- CRUD USERS & ROLES ---
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    // RBAC Security Rules:
    // Normal administrators can only assign roles in the hotel they are linked to.
    if (activeUser.rol !== 'super_admin') {
      if (target.hotelId !== activeUser.hotelId) {
        console.error("Acceso denegado: El administrador normal sólo puede asignar roles en su mismo hotel.");
        return;
      }
      if (newRole === 'super_admin') {
        console.error("Acceso denegado: El administrador normal no puede otorgar privilegios de Super Admin.");
        return;
      }
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));

    try {
      await syncUserToSupabase({ ...target, rol: newRole });
    } catch (err) {
      console.warn("Supabase updateUserRole sync error:", err);
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Privilegios Modificados',
      `Se modificó el rol de ${target.nombre} ${target.apellido} a [${newRole.toUpperCase()}]`
    );
  };

  const updateUserHotel = async (userId: string, hotelId: string | undefined) => {
    // RBAC Security Rules:
    // Only the Super Admin can change a user's linked hotel.
    if (activeUser.rol !== 'super_admin') {
      console.error("Acceso denegado: Únicamente el Super Admin puede cambiar el hotel enlazado.");
      return;
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, hotelId } : u));
    const target = users.find(u => u.id === userId);

    if (target) {
      try {
        await syncUserToSupabase({ ...target, hotelId });
      } catch (err) {
        console.warn("Supabase updateUserHotel sync error:", err);
      }
    }

    const hotelObj = hotels.find(h => h.id === hotelId);
    const hotelName = hotelObj ? hotelObj.nombre : 'Ninguno';

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Hotel Enlazado Actualizado',
      `Se enlazó al usuario ${target?.nombre} ${target?.apellido} al hotel [${hotelName}]`
    );
  };

  const updateUserHotels = async (userId: string, hotelIds: string[]) => {
    if (activeUser.rol !== 'super_admin') {
      console.error("Acceso denegado: Únicamente el Super Admin puede cambiar los hoteles enlazados.");
      return;
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, hotelIds, hotelId: hotelIds[0] || undefined } : u));
    const target = users.find(u => u.id === userId);

    if (target) {
      try {
        await syncUserToSupabase({ ...target, hotelIds, hotelId: hotelIds[0] || undefined });
      } catch (err) {
        console.warn("Supabase updateUserHotels sync error:", err);
      }
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Hoteles Enlazados Actualizados',
      `Se actualizaron los hoteles enlazados para ${target?.nombre} ${target?.apellido}`
    );
  };

  const toggleUserStatus = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const nextStatus = target.estado === 'activo' ? 'inactivo' : 'activo';

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, estado: nextStatus } : u));

    try {
      await syncUserToSupabase({ ...target, estado: nextStatus });
    } catch (err) {
      console.warn("Supabase toggleUserStatus sync error:", err);
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Cambio de Estado de Usuario',
      `Usuario ${target.nombre} ${target.apellido} pasó a estar ${nextStatus.toUpperCase()}`
    );
  };

  const registerUser = async (user: User) => {
    // 1. Sync to Supabase cloud database first to ensure it succeeds
    const result = await syncUserToSupabase(user);
    if (!result.success) {
      console.error("Supabase manual user registration sync failed:", result.error);
      throw new Error(friendlyError(result.error, 'registro'));
    }
    
    console.log("Successfully synced registered user to Supabase:", user.email);

    // 2. Only if DB write succeeds, update local state
    setUsers(prev => {
      if (prev.some(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase())) {
        return prev.map(u => u.email.toLowerCase() === user.email.toLowerCase() ? { ...u, ...user } : u);
      }
      return [...prev, user];
    });

    // Dispatch beautiful welcome email using real SMTP API endpoint
    const welcomeSubject = user.debeCambiarPassword
      ? emailSubject('Bienvenido/a a Roomia PMS', 'Cambia tu contraseña')
      : emailSubject('Bienvenido/a a Roomia PMS', 'Tu cuenta está lista');

    const welcome: BrandEmail = {
      preheader: 'Tu cuenta de Roomia PMS está lista.',
      eyebrow: 'Bienvenida',
      title: '¡Tu cuenta está lista!',
      greeting: `Hola, ${user.nombre} ${user.apellido}`,
      paragraphs: [
        'Te damos la bienvenida a **Roomia PMS**. Desde tu cuenta puedes reservar, pagar en línea, ver tus reservas y descargar tus comprobantes.'
      ],
      sections: [{
        title: 'Datos de tu cuenta',
        rows: [
          ['Nombre', `${user.nombre} ${user.apellido}`],
          ['Correo de acceso', user.email],
          ['Teléfono', user.telefono],
          ['Fecha de registro', user.fechaRegistro]
        ]
      }],
      note: user.debeCambiarPassword
        ? { text: '**Cambio de contraseña obligatorio:** tu cuenta la creó el personal del establecimiento. La primera vez que ingreses te pediremos crear una contraseña nueva.', tone: 'warning' }
        : undefined,
      cta: { label: 'Ingresar a Roomia PMS', url: PRODUCTION_ORIGIN }
    };
    const emailBody = renderBrandText(welcome);
    const emailHtml = renderBrandEmail(welcome);

    try {
      const emailResponse = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: user.email,
          subject: welcomeSubject,
          text: emailBody,
          html: emailHtml
        })
      });

      const contentType = emailResponse.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const emailData = await emailResponse.json();
        console.log("[WELCOME EMAIL DISPATCH RESULT]", emailData);
      } else {
        const textResult = await emailResponse.text();
        console.warn("[WELCOME EMAIL NON-JSON RESPONSE]", textResult.substring(0, 150));
      }
    } catch (mailErr) {
      console.error("Failed to dispatch welcoming email through server:", mailErr);
    }

    addLog(
      'Sistema',
      'guest',
      'Registro',
      `Nuevo usuario registrado: ${user.nombre} ${user.apellido} (${user.email}). ${user.debeCambiarPassword ? 'Clave temporal enviada por correo.' : ''}`
    );
  };

  // Helper for actual automated SMTP email dispatches via real SMTP backend service
  const sendReservationEmailNotification = async (
    resObj: Reservation,
    hotelObj: Hotel | undefined,
    roomObj: Room | undefined,
    guestObj: User | undefined
  ) => {
    const recipientEmail = guestObj?.email || activeUser?.email || 'soporte@roomia.com';
    const recipientName = guestObj ? `${guestObj.nombre} ${guestObj.apellido}` : 'Huésped de Honor';
    const isConfirmed = resObj.estado === 'confirmada' || resObj.estado === 'ocupada' || resObj.estado === 'finalizada';

    const subject = emailSubject(isConfirmed ? 'Reserva confirmada' : 'Reserva pendiente de pago', resObj.id, hotelObj?.nombre);

    const pagado = resObj.montoPagado ?? 0;
    const pendiente = resObj.montoPendiente ?? Math.max(0, resObj.total - pagado);
    const reservationEmail: BrandEmail = {
      preheader: isConfirmed
        ? `Tu reserva ${resObj.id} en ${hotelObj?.nombre || 'Roomia'} está confirmada.`
        : `Tu reserva ${resObj.id} está registrada y pendiente de pago.`,
      eyebrow: isConfirmed ? 'Reserva confirmada' : 'Reserva registrada',
      title: hotelObj?.nombre || 'Tu reserva en Roomia',
      greeting: `Hola, ${recipientName}`,
      paragraphs: [
        isConfirmed
          ? `Tu estadía en **${hotelObj?.nombre || 'el establecimiento'}** está confirmada. Te esperamos en las fechas indicadas.`
          : `Registramos tu reserva en **${hotelObj?.nombre || 'el establecimiento'}**. Para confirmarla, paga al menos el **20%** en las próximas **24 horas** desde "Mis reservas" (con tarjeta o tu cuenta Payphone) o directamente con el establecimiento.`
      ],
      status: {
        label: 'Estado de la reserva',
        value: isConfirmed ? (pendiente > 0 ? 'Confirmada · saldo pendiente' : 'Confirmada y pagada') : 'Pendiente de pago',
        tone: isConfirmed ? 'success' : 'warning',
        reference: `Código ${resObj.id}`
      },
      sections: [
        {
          title: 'Detalles de la estadía',
          rows: [
            ['Establecimiento', hotelObj?.nombre],
            ['Dirección', hotelObj?.ubicacion],
            ['Habitación', roomObj ? `${roomObj.numero ? `${roomObj.numero} · ` : ''}${roomObj.nombre}` : undefined],
            ['Entrada', `${resObj.fechaEntrada}${hotelObj?.horarios?.checkIn ? ` desde las ${hotelObj.horarios.checkIn}` : ''}`],
            ['Salida', `${resObj.fechaSalida}${hotelObj?.horarios?.checkOut ? ` hasta las ${hotelObj.horarios.checkOut}` : ''}`],
            ['Servicios adicionales', resObj.serviciosAdicionales?.length ? resObj.serviciosAdicionales.join(', ') : undefined]
          ]
        }
      ],
      amounts: {
        title: 'Resumen de pago',
        rows: [
          ['Subtotal', money(resObj.subtotal)],
          ['Impuestos (IVA)', money(resObj.impuestos)],
          ...(pagado > 0 ? [['Pagado', money(pagado)] as [string, string]] : [])
        ],
        total: pagado > 0 ? ['Saldo pendiente', money(pendiente)] : ['Total', money(resObj.total)]
      },
      cta: { label: isConfirmed ? 'Ver mi reserva' : 'Pagar mi reserva', url: `${PRODUCTION_ORIGIN}/?seccion=mis-reservas` },
      contact: hotelContactLine(hotelObj)
    };
    const htmlBody = renderBrandEmail(reservationEmail);
    const textBody = renderBrandText(reservationEmail);

    try {
      const apiEndpoint = `${getApiBaseUrl()}/api/send-email`;
      console.log(`[SMTP EMAIL TRIGGER] Dispatching to endpoint: ${apiEndpoint}`);
      const r = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          html: htmlBody,
          text: textBody
        })
      });
      const cType = r.headers.get("content-type");
      if (cType && cType.includes("application/json")) {
        const data = await r.json();
        console.log("[SMTP EMAIL DISPATCH RESULT]:", data);
      } else {
        const textResult = await r.text();
        console.warn("[SMTP EMAIL NON-JSON RESULT]:", textResult.substring(0, 150));
      }
    } catch (apiErr) {
      console.error("[SMTP EMAIL EXCEPTION]:", apiErr);
    }
  };

  // Helper to notify hotel administrators about a pending reservation
  const sendPendingReservationAdminNotification = async (
    resObj: Reservation,
    hotelObj: Hotel | undefined,
    roomObj: Room | undefined,
    guestObj: User | undefined
  ) => {
    // Los destinatarios los calcula el servidor (función notify-reservation), que incluye el
    // correo privado del propietario. Esta lista (sin el propietario) solo se usa si la función falla.
    const recipientEmails: string[] = [];

    // Find all users who are hotel administrators for this hotel
    const admins = users.filter(u => 
      u.rol === 'hotel_admin' && 
      (u.hotelId === resObj.hotelId || u.hotelIds?.includes(resObj.hotelId))
    );
    admins.forEach(admin => {
      if (admin.email && !recipientEmails.includes(admin.email)) {
        recipientEmails.push(admin.email);
      }
    });

    // Also include the hotel contact email
    if (hotelObj?.contacto?.email && !recipientEmails.includes(hotelObj.contacto.email)) {
      recipientEmails.push(hotelObj.contacto.email);
    }

    // If still no recipients found, fallback to system support
    if (recipientEmails.length === 0) {
      recipientEmails.push('soporte@roomia.com');
    }

    const guestName = guestObj ? `${guestObj.nombre} ${guestObj.apellido}`.trim() : 'Nuevo cliente';

    const subject = emailSubject('Nueva reserva pendiente de pago', resObj.id, hotelObj?.nombre);

    const adminEmail: BrandEmail = {
      preheader: `${guestName} reservó del ${resObj.fechaEntrada} al ${resObj.fechaSalida} (${money(resObj.total)}).`,
      eyebrow: 'Nueva reserva',
      title: 'Reserva pendiente de pago',
      greeting: 'Hola, equipo de ' + (hotelObj?.nombre || 'tu establecimiento'),
      paragraphs: [
        `**${guestName}** hizo una reserva en **${hotelObj?.nombre || 'tu establecimiento'}**. Está pendiente de pago: el huésped puede pagar en línea desde Roomia o pagarte directamente.`,
        'Si no se registra al menos el 20% en 24 horas, la reserva se cancela automáticamente y las fechas vuelven a quedar libres.'
      ],
      status: { label: 'Estado', value: 'Pendiente de pago', tone: 'warning', reference: `Código ${resObj.id}` },
      sections: [
        {
          title: 'Huésped',
          rows: [
            ['Nombre', guestName],
            ['Correo', guestObj?.email],
            ['Teléfono', guestObj?.telefono]
          ]
        },
        {
          title: 'Estadía',
          rows: [
            ['Habitación', roomObj ? `${roomObj.numero ? `${roomObj.numero} · ` : ''}${roomObj.nombre}` : undefined],
            ['Entrada', resObj.fechaEntrada],
            ['Salida', resObj.fechaSalida],
            ['Servicios adicionales', resObj.serviciosAdicionales?.length ? resObj.serviciosAdicionales.join(', ') : undefined],
            ['Notas del huésped', resObj.notas]
          ]
        }
      ],
      amounts: {
        title: 'Monto de la reserva',
        rows: [
          ['Subtotal', money(resObj.subtotal)],
          ['Impuestos (IVA)', money(resObj.impuestos)],
          ['Abono mínimo (20%)', money(Math.round(resObj.total * 20) / 100)]
        ],
        total: ['Total', money(resObj.total)]
      },
      cta: { label: 'Abrir el panel de reservas', url: PRODUCTION_ORIGIN }
    };
    const htmlBody = renderBrandEmail(adminEmail);
    const textBody = renderBrandText(adminEmail);

    // 1. El servidor envía el aviso (admins, correo del establecimiento y propietario)
    try {
      const { data, error } = await supabase.functions.invoke('notify-reservation', {
        body: { reservationId: resObj.id, subject, html: htmlBody, text: textBody }
      });
      if (!error && data && typeof data.sent === 'number') {
        console.log(`[PENDING NOTIFICATION] Aviso enviado por el servidor a ${data.sent} de ${data.total ?? data.sent} destinatarios.`);
        return;
      }
      console.warn('[PENDING NOTIFICATION] La función de avisos no respondió bien, se usa el envío de respaldo:', error?.message || data);
    } catch (fnErr) {
      console.warn('[PENDING NOTIFICATION] Función de avisos no disponible, se usa el envío de respaldo:', fnErr);
    }

    // 2. Respaldo: admins y correo del establecimiento (sin el propietario, cuyo correo es privado)
    try {
      const apiEndpoint = `${getApiBaseUrl()}/api/send-email`;
      await Promise.all(recipientEmails.map(async (email) => {
        try {
          await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: email, subject, html: htmlBody, text: textBody })
          });
        } catch (singleErr) {
          console.error(`[PENDING NOTIFICATION SINGLE ERR] Email to ${email} failed:`, singleErr);
        }
      }));
    } catch (apiErr) {
      console.error("[PENDING NOTIFICATION ADMIN EXCEPTION]:", apiErr);
    }
  };

  // --- FLOW RESERVATIONS ---
  const createReservation = async (newRes: Reservation): Promise<boolean> => {
    const resToSave: Reservation = {
      ...newRes,
      fechaRegistroTimestamp: newRes.fechaRegistroTimestamp || new Date().toISOString()
    };

    // Estado previo, por si la base de datos rechaza la reserva por solapamiento
    const previousRes = reservations.find(r => r.id === resToSave.id);
    const previousRoomStatus = rooms.find(r => r.id === resToSave.roomId)?.estado;

    setReservations(prev => {
      const exists = prev.some(r => r.id === resToSave.id);
      if (exists) {
        return prev.map(r => r.id === resToSave.id ? resToSave : r);
      }
      return [resToSave, ...prev];
    });
    setRooms(prev => prev.map(r => r.id === resToSave.roomId ? { ...r, estado: 'reservado' } : r));

    try {
      const syncResult = await syncReservationToSupabase(resToSave);

      if (!syncResult.success) {
        // La base de datos rechazó la reserva (fechas ya tomadas por otra reserva o bloqueadas por
        // Airbnb/Booking) o no pudo guardarla: se deshace el cambio local y se avisa, en vez de
        // mostrar como creada una reserva que no existe.
        setReservations(prev => previousRes
          ? prev.map(r => r.id === resToSave.id ? previousRes : r)
          : prev.filter(r => r.id !== resToSave.id));
        if (previousRoomStatus) {
          setRooms(prev => prev.map(r => r.id === resToSave.roomId ? { ...r, estado: previousRoomStatus } : r));
        }
        if (typeof window !== 'undefined') {
          notify.error(syncResult.overlap
            ? 'La habitación ya no está disponible en esas fechas. Elige un rango diferente.'
            : 'No pudimos guardar la reserva. Revisa tu conexión e inténtalo de nuevo.');
          window.dispatchEvent(new Event('roomia-refresh-busy'));
        }
        return false;
      }

      const matchedRoom = rooms.find(r => r.id === resToSave.roomId);
      if (matchedRoom) {
        await syncRoomToSupabase({ ...matchedRoom, estado: 'reservado' });
      }
    } catch (err) {
      console.warn("Supabase createReservation sync error:", err);
    }

    const parentHotel = hotels.find(h => h.id === newRes.hotelId);
    const room = rooms.find(r => r.id === newRes.roomId);
    let guestUser = users.find(u => u.id === newRes.guestId);
    if (!guestUser && newRes.guestId) {
      // Un huésped recién registrado en recepción todavía no está en la lista en memoria.
      // Sin esto, su correo de confirmación se enviaba al recepcionista en vez de a él.
      try {
        const { data: guestRow } = await supabase.from('users').select('*').eq('id', newRes.guestId).maybeSingle();
        if (guestRow) {
          guestUser = mapUserFromDb(guestRow);
        }
      } catch (guestErr) {
        console.warn("No se pudo cargar el huésped de la reserva:", guestErr);
      }
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Nueva Reserva',
      `Reserva ${newRes.id} creada/actualizada en ${parentHotel?.nombre} (Habitación ${room?.numero}). Estado: ${newRes.estado}. Fechas: ${newRes.fechaEntrada} a ${newRes.fechaSalida}.`
    );

    // Enviar correo de confirmación de reserva únicamente cuando su estado pase a ser "confirmada" (pagado)
    const oldResVal = reservations.find(r => r.id === newRes.id);
    const wasPendingOrCreatedBrandNew = !oldResVal || oldResVal.estado === 'pendiente';
    if (newRes.estado === 'confirmada' && wasPendingOrCreatedBrandNew) {
      sendReservationEmailNotification(newRes, parentHotel, room, guestUser);
    }

    // Notificar al administrador del hotel sobre una nueva reserva pendiente
    if (!oldResVal && newRes.estado === 'pendiente') {
      sendPendingReservationAdminNotification(newRes, parentHotel, room, guestUser);
    }

    return true;
  };

  const cancelReservation = async (resId: string) => {
    const targetRes = reservations.find(r => r.id === resId);
    if (!targetRes) return;

    setReservations(prev => prev.map(r => r.id === resId ? { ...r, estado: 'cancelada' } : r));
    setRooms(prev => prev.map(r => r.id === targetRes.roomId ? { ...r, estado: 'disponible' } : r));

    try {
      await syncReservationToSupabase({ ...targetRes, estado: 'cancelada' });
      const rRoom = rooms.find(r => r.id === targetRes.roomId);
      if (rRoom) {
        await syncRoomToSupabase({ ...rRoom, estado: 'disponible' });
      }
    } catch (err) {
      console.warn("Supabase cancelReservation sync error:", err);
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Reserva Cancelada',
      `Se canceló la reserva ${resId} para la habitación N° ${rooms.find(r => r.id === targetRes.roomId)?.numero}.`
    );
  };

  const deleteReservation = async (resId: string) => {
    const targetRes = reservations.find(r => r.id === resId);
    
    const currentDeleted = loadFromLocalStorage<string[]>(`${STORAGE_PREFIX}deleted_res_ids`, []);
    if (!currentDeleted.includes(resId)) {
      saveToLocalStorage(`${STORAGE_PREFIX}deleted_res_ids`, [...currentDeleted, resId]);
    }

    // Instead of filtering it out of the master list, set eliminadaPorCliente: true
    setReservations(prev => prev.map(r => r.id === resId ? { ...r, eliminadaPorCliente: true } : r));

    if (targetRes) {
      try {
        await syncReservationToSupabase({ ...targetRes, eliminadaPorCliente: true });
      } catch (err) {
        console.warn("Supabase deleteReservation sync error:", err);
      }
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Eliminar Evento Reserva',
      `El huésped ocultó la reserva ${resId} de su historial de huésped.`
    );
  };

  const updateUserProfile = async (userId: string, incomingData: Partial<User>) => {
    const targetUser = users.find(u => u.id === userId);
    const updatedData: Partial<User> = { ...incomingData };

    // --- CAMBIO DE CORREO ---
    // El correo con el que se inicia sesión vive en Supabase Auth, no en la tabla users.
    // Antes solo se cambiaba en la tabla, y la persona ya no podía entrar con el correo
    // nuevo. Ahora el cambio se pide a Supabase Auth y la tabla solo se actualiza cuando
    // Auth lo ha aceptado.
    const requestedEmail = typeof incomingData.email === 'string' ? incomingData.email.trim().toLowerCase() : '';
    const currentEmail = (targetUser?.email || '').trim().toLowerCase();

    if (targetUser && requestedEmail && requestedEmail !== currentEmail) {
      if (userId !== currentUserId) {
        // El correo de acceso de otra persona no se puede cambiar desde el navegador
        updatedData.email = targetUser.email;
        notify.warning('El correo de acceso solo puede cambiarlo cada persona desde su perfil.');
      } else {
        let hasAuthSession = false;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          hasAuthSession = !!session;
        } catch (sessionErr) {
          hasAuthSession = false;
        }

        if (hasAuthSession) {
          try {
            const { data, error } = await supabase.auth.updateUser({ email: requestedEmail });
            if (error) {
              updatedData.email = targetUser.email;
              const alreadyUsed = /already|registered|exists/i.test(error.message || '');
              notify.error(alreadyUsed
                ? 'Ese correo ya pertenece a otra cuenta. Tu correo no se cambió.'
                : friendlyError(error, 'correo'));
            } else if ((data?.user?.email || '').toLowerCase() === requestedEmail) {
              // Cambio inmediato (el proyecto no exige confirmar el correo)
              updatedData.email = requestedEmail;
              notify.success('Correo actualizado. Usa el nuevo correo para iniciar sesión.');
            } else {
              // Supabase envió un enlace de confirmación: hasta confirmarlo sigue valiendo el anterior
              updatedData.email = targetUser.email;
              notify.info(`Te enviamos un enlace de confirmación a ${requestedEmail}. Hasta que lo confirmes, sigue entrando con ${targetUser.email}.`);
            }
          } catch (emailErr: any) {
            updatedData.email = targetUser.email;
            notify.error(friendlyError(emailErr, 'correo'));
          }
        } else {
          updatedData.email = requestedEmail;
        }
      }
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updatedData } : u));

    if (targetUser) {
      try {
        await syncUserToSupabase({ ...targetUser, ...updatedData });
      } catch (err) {
        console.warn("Supabase updateUserProfile sync error:", err);
      }
    }
    
    // Log the profile update
    const userDisplay = targetUser 
      ? `${targetUser.nombre} ${targetUser.apellido}` 
      : `Usuario [${userId}]`;
    addLog(
      userDisplay,
      targetUser?.rol || 'cliente',
      'Actualizar Perfil',
      `Se actualizaron los datos personales de contacto, documento o imagen de foto de perfil.`
    );
  };

  const changeUserPassword = async (userId: string, newPass: string, changedByAdmin = false) => {
    // Find user first from current users state array
    const targetUser = users.find(u => u.id === userId);
    
    // Update local React state (we don't store plain-text password in users array)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, debeCambiarPassword: false } : u));

    if (!targetUser) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    try {
      // Securely update the password using Supabase Auth if it is the currently authenticated user
      if (userId === currentUserId) {
        const { error: authError } = await supabase.auth.updateUser({ password: newPass });
        if (authError) {
          console.error("Error updating password in Supabase Auth:", authError);
          return { success: false, error: friendlyError(authError, 'contrasena') };
        }
      }
      
      // Update public user profile metadata in Supabase database (does NOT serialize plaintext password)
      await syncUserToSupabase({ ...targetUser, debeCambiarPassword: false });
    } catch (err) {
      console.warn("Supabase changeUserPassword profile sync error:", err);
    }

    const editorName = activeUser ? `${activeUser.nombre} ${activeUser.apellido}` : 'Sistema';
    addLog(
      editorName,
      activeUser?.rol || 'super_admin',
      'Cambio Contraseña',
      `Se actualizó la contraseña del usuario ${targetUser.nombre} ${targetUser.apellido} (${targetUser.email}).`
    );

    // Send real email notification about password change
    const passwordSubject = emailSubject('Contraseña cambiada');
    const passwordEmail: BrandEmail = {
      preheader: 'Aviso de seguridad de tu cuenta.',
      eyebrow: 'Seguridad de la cuenta',
      title: 'Contraseña actualizada',
      greeting: `Hola, ${targetUser.nombre} ${targetUser.apellido}`,
      paragraphs: [
        changedByAdmin
          ? 'El personal de administración restableció la contraseña de tu cuenta. Por seguridad, nunca enviamos contraseñas por correo.'
          : 'La contraseña de tu cuenta se cambió desde tu perfil.'
      ],
      status: { label: 'Cambio realizado', value: new Date().toLocaleString('es-EC'), tone: 'info' },
      note: { text: '**¿No fuiste tú?** Comunícate de inmediato con el establecimiento o con soporte para proteger tu cuenta.', tone: 'danger' },
      cta: { label: 'Ingresar a Roomia PMS', url: PRODUCTION_ORIGIN }
    };

    try {
      await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: targetUser.email,
          subject: passwordSubject,
          text: renderBrandText(passwordEmail),
          html: renderBrandEmail(passwordEmail)
        })
      });
    } catch (mailErr) {
      console.error("Failed to dispatcher email notification on password change:", mailErr);
    }

    return { success: true };
  };

  const updateReservationStatus = async (
    resId: string, 
    status: ReservationStatus,
    staffName?: string,
    staffRole?: string,
    mensajeCambio?: string,
    montoPagado?: number,
    montoPendiente?: number
  ) => {
    const changes: Partial<Reservation> = { estado: status };
    if (montoPagado !== undefined) {
      changes.montoPagado = montoPagado;
    }
    if (montoPendiente !== undefined) {
      changes.montoPendiente = montoPendiente;
    }
    if (staffName && staffRole) {
      const updaterInfo = `${staffRole === 'super_admin' ? 'Super Administrador' : staffRole === 'hotel_admin' ? 'Administrador de Hotel' : 'Recepcionista'} (${staffName})`;
      changes.modificadoPor = updaterInfo;
      changes.mensajeCambio = mensajeCambio || `Reserva cambiada a "${status}"`;
      changes.fechaCambio = new Date().toISOString();
    }

    const targetRes = reservations.find(r => r.id === resId);
    if (targetRes) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (status === 'finalizada' && targetRes.fechaSalida > todayStr) {
        changes.fechaSalida = todayStr;
        changes.checkedOutAt = new Date().toISOString();
      } else if (status === 'finalizada') {
        changes.checkedOutAt = new Date().toISOString();
      }

      // Sync reservation changes locally
      setReservations(prev => prev.map(r => r.id === resId ? { ...r, ...changes } : r));

      // Si el estado pasa de pendiente de pago a confirmada, enviar el correo de confirmación
      if (status === 'confirmada' && targetRes.estado === 'pendiente') {
        const parentHotel = hotels.find(h => h.id === targetRes.hotelId);
        const roomObj = rooms.find(r => r.id === targetRes.roomId);
        const guestUser = users.find(u => u.id === targetRes.guestId);
        sendReservationEmailNotification({ ...targetRes, ...changes }, parentHotel, roomObj, guestUser);
      }

      try {
        const synced = await syncReservationToSupabase({ ...targetRes, ...changes });
        // Check-out: envía al SRI la factura automática que creó la base, sin esperar al cron
        if (synced.success && status === 'finalizada') procesarFacturaDeReserva(resId).catch(() => undefined);
      } catch (err) {
        console.warn("Supabase updateReservationStatus error:", err);
      }

      // Determine new room status based on the updated reservation status
      let newRoomStatus: RoomStatus | undefined;
      if (status === 'finalizada' || status === 'cancelada') {
        newRoomStatus = 'disponible';
      } else if (status === 'ocupada') {
        newRoomStatus = 'ocupado';
      } else if (status === 'confirmada' || status === 'pendiente') {
        newRoomStatus = 'reservado';
      }

      if (newRoomStatus) {
        // Update local room status
        setRooms(prev => prev.map(r => r.id === targetRes.roomId ? { ...r, estado: newRoomStatus! } : r));

        // Sync room status to supabase
        const targetRoom = rooms.find(r => r.id === targetRes.roomId);
        if (targetRoom) {
          try {
            await syncRoomToSupabase({ ...targetRoom, estado: newRoomStatus });
          } catch (rErr) {
            console.warn("Supabase updateRoomStatus via reservation error:", rErr);
          }
        }
      }
    }

    addLog(
      staffName || `${activeUser.nombre} ${activeUser.apellido}`,
      staffRole || activeUser.rol,
      'Estado Reserva Actualizado',
      `La Reserva ${resId} cambió de estado a "${status}"`
    );
  };

  const updateRoomStatus = async (
    roomId: string, 
    newStatus: RoomStatus,
    staffName?: string,
    staffRole?: string,
    changeMessage?: string
  ) => {
    const targetRoom = rooms.find(r => r.id === roomId);
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, estado: newStatus } : r));

    if (targetRoom) {
      try {
        await syncRoomToSupabase({ ...targetRoom, estado: newStatus });
      } catch (err) {
        console.warn("Supabase updateRoomStatus error:", err);
      }
    }

    // Propagate change message to active reservations linked to this room
    if (staffName && staffRole && changeMessage) {
      const affectedReservations = reservations.filter(
        r => r.roomId === roomId && r.estado !== 'finalizada' && r.estado !== 'cancelada'
      );
      const updaterInfo = `${staffRole === 'super_admin' ? 'Super Administrador' : staffRole === 'hotel_admin' ? 'Administrador de Hotel' : 'Recepcionista'} (${staffName})`;
      
      for (const res of affectedReservations) {
        const updatedFields: Partial<Reservation> = {
          modificadoPor: updaterInfo,
          mensajeCambio: `Habitación changed to "${newStatus}": ${changeMessage}`,
          fechaCambio: new Date().toISOString()
        };

        setReservations(prev => prev.map(r => r.id === res.id ? { ...r, ...updatedFields } : r));

        try {
          await syncReservationToSupabase({ ...res, ...updatedFields });
        } catch (e) {
          console.warn("Supabase affected reservation sync error:", e);
        }
      }
    }

    addLog(
      staffName || `${activeUser.nombre} ${activeUser.apellido}`,
      staffRole || activeUser.rol,
      'Eliminar Habitación',
      `Habitación N° ${targetRoom?.numero || roomId} cambiada de estado a ${newStatus}.`
    );
  };

  // --- CHECK-IN WITH QR METRICS (OPERATIONS EXCLUSIVE) ---
  const performCheckIn = (resId: string, receptionistId: string) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return { success: false, msg: 'Reserva no encontrada.' };

    const rx = users.find(u => u.id === receptionistId);
    const nowIso = new Date().toISOString();

    // Update reservation
    setReservations(prev => prev.map(r => r.id === resId ? {
      ...r,
      estado: 'ocupada',
      checkedInAt: nowIso,
      recepcionistaId: receptionistId,
      montoPagado: r.total,
      montoPendiente: 0
    } : r));

    // Update Room: reservado -> ocupado
    setRooms(prev => prev.map(r => r.id === res.roomId ? { ...r, estado: 'ocupado' } : r));

    const updatedRes = {
      ...res,
      estado: 'ocupada' as ReservationStatus,
      checkedInAt: nowIso,
      recepcionistaId: receptionistId,
      montoPagado: res.total,
      montoPendiente: 0
    };

    try {
      syncReservationToSupabase(updatedRes);
      const mRoom = rooms.find(r => r.id === res.roomId);
      if (mRoom) {
        syncRoomToSupabase({ ...mRoom, estado: 'ocupado' });
      }
    } catch (e) {
      console.warn("Supabase performCheckIn error:", e);
    }

    addLog(
      rx ? `${rx.nombre} ${rx.apellido}` : 'Recepción',
      'recepcionista',
      'Check-In Confirmado',
      `Check-In completado para la reserva ${resId}. Habitación cambiada a OCUPADO.`
    );

    return { success: true, msg: 'Check-In procesado exitosamente.' };
  };

  const performCheckOut = (resId: string, receptionistId: string) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return { success: false, msg: 'Reserva no encontrada.' };

    const rx = users.find(u => u.id === receptionistId);
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    const updatedResChanges: Partial<Reservation> = {
      estado: 'finalizada' as ReservationStatus,
      checkedOutAt: nowIso
    };

    if (res.fechaSalida > todayStr) {
      updatedResChanges.fechaSalida = todayStr;
    }

    // Update reservation
    setReservations(prev => prev.map(r => r.id === resId ? {
      ...r,
      ...updatedResChanges
    } : r));

    // Update Room: ocupado -> disponible
    setRooms(prev => prev.map(r => r.id === res.roomId ? { ...r, estado: 'disponible' } : r));

    const updatedRes = {
      ...res,
      ...updatedResChanges
    };

    try {
      // Check-out: envía al SRI la factura automática que creó la base, sin esperar al cron
      syncReservationToSupabase(updatedRes).then(synced => {
        if (synced.success) procesarFacturaDeReserva(resId).catch(() => undefined);
      });
      const mRoom = rooms.find(r => r.id === res.roomId);
      if (mRoom) {
        syncRoomToSupabase({ ...mRoom, estado: 'disponible' });
      }
    } catch (e) {
      console.warn("Supabase performCheckOut error:", e);
    }

    addLog(
      rx ? `${rx.nombre} ${rx.apellido}` : 'Recepción',
      'recepcionista',
      'Check-Out Confirmado',
      `Check-Out procesado para la reserva ${resId}. Habitación cambiada a DISPONIBLE.`
    );

    return { success: true, msg: 'Check-Out procesado exitosamente. La habitación ahora se encuentra disponible.' };
  };

  // --- CALCULATE REALTIME STATISTICS ---
  const getStatistics = () => {
    const totalReservas = reservations.length;
    const completadas = reservations.filter(r => r.estado === 'finalizada').length;
    const activas = reservations.filter(r => r.estado === 'ocupada' || r.estado === 'confirmada').length;
    const canceladas = reservations.filter(r => r.estado === 'cancelada').length;

    const totalIngresos = reservations
      .filter(r => r.estado === 'ocupada' || r.estado === 'finalizada')
      .reduce((sum, r) => sum + r.total, 0);

    const totalHabitacionesCount = rooms.length;
    const habOcupadas = rooms.filter(r => r.estado === 'ocupado').length;
    const habDisponibles = rooms.filter(r => r.estado === 'disponible').length;
    const habMantenimiento = rooms.filter(r => r.estado === 'mantenimiento').length;
    const habReservadas = rooms.filter(r => r.estado === 'reservado').length;

    const ocupacionPorcentaje = totalHabitacionesCount > 0 
      ? Math.round((habOcupadas / totalHabitacionesCount) * 100) 
      : 0;

    // Calculate revenue breakdown by hotel
    const ingresosPorHotel = hotels.map(hotel => {
      const totalHotelRevenue = reservations
        .filter(r => r.hotelId === hotel.id && (r.estado === 'ocupada' || r.estado === 'finalizada'))
        .reduce((sum, r) => sum + r.total, 0);
      return {
        name: hotel.nombre,
        ingresos: parseFloat(totalHotelRevenue.toFixed(2))
      };
    });

    // Calculate reservation status summary
    const statusPie = [
      { name: 'Ocupadas', value: habOcupadas, color: '#f59e0b' },
      { name: 'Disponibles', value: habDisponibles, color: '#10b981' },
      { name: 'En Mantenimiento', value: habMantenimiento, color: '#ef4444' },
      { name: 'Reservadas', value: habReservadas, color: '#3b82f6' }
    ];

    // Client frequent stats
    const clientReservationCounts: { [guestId: string]: number } = {};
    reservations.forEach(r => {
      clientReservationCounts[r.guestId] = (clientReservationCounts[r.guestId] || 0) + 1;
    });

    const clientesFrecuentes = Object.entries(clientReservationCounts)
      .map(([guestId, count]) => {
        const u = users.find(usr => usr.id === guestId);
        return {
          id: guestId,
          nombre: u ? `${u.nombre} ${u.apellido}` : 'Cliente Externo',
          email: u?.email || '',
          reservas: count,
          avatar: u?.avatar || ''
        };
      })
      .sort((a, b) => b.reservas - a.reservas)
      .slice(0, 5);

    return {
      totalIngresos,
      totalReservas,
      completadas,
      activas,
      canceladas,
      totalHabitacionesCount,
      habOcupadas,
      habDisponibles,
      habMantenimiento,
      habReservadas,
      ocupacionPorcentaje,
      ingresosPorHotel,
      statusPie,
      clientesFrecuentes
    };
  };

  const syncAllToSupabase = async (): Promise<{
    success: boolean;
    details: {
      hotels: { count: number; error?: string };
      rooms: { count: number; error?: string };
      users: { count: number; error?: string };
      reservations: { count: number; error?: string };
      logs: { count: number; error?: string };
    };
  }> => {
    const details = {
      hotels: { count: 0, error: undefined as string | undefined },
      rooms: { count: 0, error: undefined as string | undefined },
      users: { count: 0, error: undefined as string | undefined },
      reservations: { count: 0, error: undefined as string | undefined },
      logs: { count: 0, error: undefined as string | undefined },
    };

    // 1. Sync Hotels
    let hotelsErr = '';
    for (const h of hotels) {
      try {
        const res = await syncHotelToSupabase(h);
        if (res.success) {
          details.hotels.count++;
        } else {
          hotelsErr = res.error || 'Error desconocido';
        }
      } catch (e: any) {
        hotelsErr = e.message || String(e);
      }
    }
    if (hotelsErr) details.hotels.error = hotelsErr;

    // 2. Sync Rooms
    let roomsErr = '';
    for (const r of rooms) {
      try {
        const res = await syncRoomToSupabase(r);
        if (res.success) {
          details.rooms.count++;
        } else {
          roomsErr = res.error || 'Error desconocido';
        }
      } catch (e: any) {
        roomsErr = e.message || String(e);
      }
    }
    if (roomsErr) details.rooms.error = roomsErr;

    // 3. Sync Users
    let usersErr = '';
    for (const u of users) {
      try {
        const res = await syncUserToSupabase(u);
        if (res.success) {
          details.users.count++;
        } else {
          usersErr = res.error || 'Error desconocido';
        }
      } catch (e: any) {
        usersErr = e.message || String(e);
      }
    }
    if (usersErr) details.users.error = usersErr;

    // 4. Sync Reservations
    let rsvErr = '';
    for (const res of reservations) {
      try {
        const r = await syncReservationToSupabase(res);
        if (r.success) {
          details.reservations.count++;
        } else {
          rsvErr = r.error || 'Error desconocido';
        }
      } catch (e: any) {
        rsvErr = e.message || String(e);
      }
    }
    if (rsvErr) details.reservations.error = rsvErr;

    // 5. Sync Logs
    let logsErr = '';
    for (const l of logs) {
      try {
        const res = await syncLogToSupabase(l);
        if (res.success) {
          details.logs.count++;
        } else {
          logsErr = res.error || 'Error desconocido';
        }
      } catch (e: any) {
        logsErr = e.message || String(e);
      }
    }
    if (logsErr) details.logs.error = logsErr;

    const hasErrors = !!(details.hotels.error || details.rooms.error || details.users.error || details.reservations.error || details.logs.error);
    return {
      success: !hasErrors,
      details
    };
  };

  const sendChatMessage = async (msg: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return sortMessagesChronologically([...prev, msg]);
    });

    // Emit live chat message via persistent WebSocket connection
    try {
      const socket = getSocket();
      if (socket) {
        socket.emit("chat:message", msg);
      }
    } catch (e) {
      console.warn("WebSocket sendChatMessage emit error:", e);
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('roomia_live_chat_sync');
        bc.postMessage({ type: 'CHAT_MSG', msg });
        bc.close();
      } catch (e) {
        // silent
      }
    }

    try {
      await syncChatMessageToSupabase(msg);
    } catch (e) {
      console.error("ChatMessage Sync error:", e);
    }
  };

  const markMessagesAsRead = async (
    hotelId: string, 
    senderId: string, 
    senderRole: UserRole, 
    options?: { targetCustomerId?: string; isClientReading?: boolean }
  ) => {
    setMessages(prev => prev.map(m => {
      if (m.hotelId !== hotelId) return m;

      // 1. Si el cliente está leyendo: marca como leídos los mensajes dirigidos a él
      if (options?.isClientReading || senderRole === 'cliente') {
        const cId = senderId;
        if ((m.recipientId === cId || m.customerId === cId) && m.senderRole !== 'cliente') {
          return { ...m, read: true };
        }
      }

      // 2. Si el staff está atendiendo la conversación de un huésped específico
      if (options?.targetCustomerId) {
        if (m.senderId === options.targetCustomerId && m.senderRole === 'cliente') {
          return { ...m, read: true };
        }
      }

      // 3. Fallback estándar (ej. staff leyendo mensajes de un remitente específico)
      if (m.senderId === senderId && m.senderRole === senderRole) {
        return { ...m, read: true };
      }

      return m;
    }));

    // Emit read status via persistent WebSocket connection
    try {
      const socket = getSocket();
      if (socket) {
        socket.emit("chat:read", { hotelId, senderId, senderRole, ...options });
      }
    } catch (e) {
      console.warn("WebSocket markMessagesAsRead emit error:", e);
    }
    try {
      if (options?.isClientReading || senderRole === 'cliente') {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('hotelid', hotelId);
        if (data) {
          for (const item of data) {
            const mapped = mapChatMessageFromDb(item);
            if ((mapped.recipientId === senderId || mapped.customerId === senderId) && mapped.senderRole !== 'cliente' && !mapped.read) {
              await supabase
                .from('messages')
                .update({ read: true })
                .eq('id', item.id);
            }
          }
        }
      } else if (options?.targetCustomerId) {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('hotelid', hotelId)
          .eq('senderid', options.targetCustomerId)
          .eq('senderrole', 'cliente');
        if (data) {
          for (const item of data) {
            await supabase
              .from('messages')
              .update({ read: true })
              .eq('id', item.id);
          }
        }
      } else {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('hotelid', hotelId)
          .eq('senderid', senderId)
          .eq('senderrole', senderRole);
        if (data) {
          for (const item of data) {
            await supabase
              .from('messages')
              .update({ read: true })
              .eq('id', item.id);
          }
        }
      }
    } catch (e) {
      console.error("Error setting messages to read in DB:", e);
    }
  };

  const addPaymentTransaction = async (tx: PaymentTransaction) => {
    setTransactions(prev => {
      if (prev.some(t => t.id === tx.id)) return prev;
      return [...prev, tx];
    });
    try {
      await syncPaymentTransactionToSupabase(tx);
    } catch (e) {
      console.error("PaymentTransaction Sync error:", e);
    }
  };

  const submitReview = async (review: Review) => {
    setReviews(prev => {
      // Avoid duplicates for same reservation
      if (prev.some(r => r.id === review.id || r.reservationId === review.reservationId)) {
        return prev.map(r => r.id === review.id || r.reservationId === review.reservationId ? review : r);
      }
      return [...prev, review];
    });

    try {
      await syncReviewToSupabase(review);
    } catch (e) {
      console.error("Supabase syncReview error:", e);
    }

    addLog(
      'Sistema',
      'cliente',
      'Nueva Valoración',
      `Cliente añadió una valoración de ${review.rating} estrellas para la estancia en la reserva ID: ${review.reservationId}`
    );
  };

  const saveRoomPriceVariation = async (variation: RoomPriceVariation) => {
    setRoomPriceVariations(prev => {
      if (prev.some(v => v.id === variation.id)) {
        return prev.map(v => v.id === variation.id ? variation : v);
      }
      return [...prev, variation];
    });

    try {
      await syncRoomPriceVariationToSupabase(variation);
    } catch (e) {
      console.error("Supabase syncRoomPriceVariation error:", e);
    }

    addLog(
      'Sistema',
      'super_admin',
      'Modificación Precio Variable',
      `Se configuró una variación tarifaria para la habitación ID: ${variation.roomId} con precio especial de $${variation.precio} USD.`
    );
  };

  const deleteRoomPriceVariation = async (id: string) => {
    setRoomPriceVariations(prev => prev.filter(v => v.id !== id));
    try {
      await deleteRoomPriceVariationFromSupabase(id);
    } catch (e) {
      console.error("Supabase deleteRoomPriceVariation error:", e);
    }
  };

  const refreshCatalogFromSupabase = async () => {
    try {
      console.log("🔄 Sincronizando catálogo directamente de Supabase DB...");
      const [hotelsRes, roomsRes, reviewsRes, variationsRes] = await Promise.allSettled([
        supabase.from('hotels').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('reviews').select('*'),
        supabase.from('room_price_variations').select('*')
      ]);

      if (hotelsRes.status === 'fulfilled' && hotelsRes.value.data) {
        const mappedHotels = hotelsRes.value.data.map(mapHotelFromDb).filter(Boolean) as Hotel[];
        const sanitized = sanitizeHotels(mappedHotels);
        setHotels(sanitized);
        saveToLocalStorage(KEYS.HOTELS, sanitized);
        if (canSeeOwners) loadHotelOwners();
      }

      if (roomsRes.status === 'fulfilled' && roomsRes.value.data) {
        const mappedRooms = roomsRes.value.data.map(mapRoomFromDb).filter(Boolean) as Room[];
        setRooms(mappedRooms);
        saveToLocalStorage(KEYS.ROOMS, mappedRooms);
      }

      if (reviewsRes.status === 'fulfilled' && reviewsRes.value.data) {
        const mappedReviews = reviewsRes.value.data.map(mapReviewFromDb).filter(Boolean) as Review[];
        setReviews(mappedReviews);
        saveToLocalStorage('reviews', mappedReviews);
      }

      if (variationsRes.status === 'fulfilled' && variationsRes.value.data) {
        const mappedVariations = variationsRes.value.data.map(mapRoomPriceVariationFromDb).filter(Boolean) as RoomPriceVariation[];
        setRoomPriceVariations(mappedVariations);
        saveToLocalStorage('roomPriceVariations', mappedVariations);
      }
      return true;
    } catch (err) {
      console.warn("Error re-sincronizando catálogo desde Supabase:", err);
      return false;
    }
  };

  return {
    hotels: hotelsWithOwners,
    rooms,
    users,
    reservations: reservationsWithBusy,
    icalFeeds,
    externalBlocks,
    refreshIcal,
    logs,
    messages,
    transactions,
    reviews,
    roomPriceVariations,
    activeUser,
    activeUserId: currentUserId,
    isInitialSyncing,
    switchSessionUser,
    factoryResetAll,
    saveHotel,
    deleteHotel,
    saveRoom,
    deleteRoom,
    updateRoomStatus,
    updateUserRole,
    updateUserHotel,
    updateUserHotels,
    toggleUserStatus,
    registerUser,
    updateUserProfile,
    changeUserPassword,
    createReservation,
    cancelReservation,
    deleteReservation,
    updateReservationStatus,
    performCheckIn,
    performCheckOut,
    addLog,
    getStatistics,
    syncAllToSupabase,
    refreshCatalogFromSupabase,
    sendChatMessage,
    markMessagesAsRead,
    addPaymentTransaction,
    submitReview,
    saveRoomPriceVariation,
    deleteRoomPriceVariation
  };
}
