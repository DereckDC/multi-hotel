/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Hotel, Room, User, Reservation, RoomStatus, ReservationStatus, UserRole } from './types';
import { INITIAL_HOTELS, INITIAL_ROOMS, INITIAL_USERS, INITIAL_RESERVATIONS } from './seedData';
import {
  supabase,
  syncHotelToSupabase,
  syncRoomToSupabase,
  syncUserToSupabase,
  syncReservationToSupabase,
  syncLogToSupabase,
  deleteRowFromSupabase,
  mapHotelFromDb,
  mapRoomFromDb,
  mapUserFromDb,
  mapReservationFromDb
} from './supabase';

// Safe standard local storage storage key constants
const STORAGE_PREFIX = 'aura_hotel_pms_';

// Resolve appropriate API Base URL for APK compatibility on WebViews
export function getApiBaseUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  // If running in local dev on port 3000
  if (origin && (origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000'))) {
    return origin;
  }

  // If on hosted run.app preview
  if (origin && origin.includes('run.app')) {
    try {
      localStorage.setItem('roomia_api_origin', origin);
    } catch (e) {}
    return origin;
  }

  // Fallback to saved origin if any
  try {
    const saved = localStorage.getItem('roomia_api_origin');
    if (saved) return saved;
  } catch (e) {}

  // Production Cloud Run deployment address for Roomia instance
  return 'https://ais-pre-x2bbmoykvbb2j2cvvu5ybf-300435593784.us-east5.run.app';
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

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error loading key: ', key, error);
    return defaultValue;
  }
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving key: ', key, error);
  }
}

export const DEFAULT_DETAILED_SERVICES_MAP: Record<string, any[]> = {
  'hotel-1': [
    { id: 'srv-1-1', nombre: 'Alimentación Completa (3 comidas/día)', precio: 15, descripcion: 'Incluye desayuno buffet premium, almuerzo a la carta y cena gourmet de 3 tiempos.', estado: 'activo' },
    { id: 'srv-1-2', nombre: 'Pase de Spa de Lujo & Masaje', precio: 40, descripcion: 'Acceso a baños turcos, tinajas temperadas y un masaje descontracturante de 45 minutos.', estado: 'activo' },
    { id: 'srv-1-3', nombre: 'Tour Histórico de la Ciudad', precio: 20, descripcion: 'Recorrido privado de medio día a pie guiado por expertos locales.', estado: 'activo' }
  ],
  'hotel-2': [
    { id: 'srv-2-1', nombre: 'Pensión Gourmet de Trabajo (3 comidas)', precio: 12, descripcion: 'Comidas de especialidad preparadas por nutricionistas en el coworking café.', estado: 'activo' },
    { id: 'srv-2-2', nombre: 'Alquiler Diario de Bicicleta Eléctrica', precio: 10, descripcion: 'Unidades premium con batería de alto rendimiento e indicador de ruta inteligente.', estado: 'activo' },
    { id: 'srv-2-3', nombre: 'Pase Sunset Yoga & Meditación', precio: 8, descripcion: 'Sesión relajante al atardecer en nuestra terraza tropical con bebida de cortesía.', estado: 'activo' }
  ],
  'hotel-3': [
    { id: 'srv-3-1', nombre: 'Cesta Gastronómica de Campo (3 comidas)', precio: 18, descripcion: 'Deliciosas preparaciones campestres traídas calientes directamente a tu cabaña.', estado: 'activo' },
    { id: 'srv-3-2', nombre: 'Navegación Guiada en Lago Glaciar', precio: 35, descripcion: 'Paseo exclusivo en velero por la costa norte con tablas de fiambres y vinos.', estado: 'activo' },
    { id: 'srv-3-3', nombre: 'Reserva de Tinaja Ecológica Privada', precio: 25, descripcion: 'Tina exterior temperada a leña con hierbas aromáticas y velas por 1 hora.', estado: 'activo' }
  ]
};

export const sanitizeHotels = (list: Hotel[]): Hotel[] => {
  return list.map(h => {
    const defaultServices = DEFAULT_DETAILED_SERVICES_MAP[h.id] || [];
    return {
      ...h,
      serviciosDetallados: h.serviciosDetallados && h.serviciosDetallados.length > 0 
        ? h.serviciosDetallados 
        : defaultServices
    };
  });
};

export function useHotelStore() {
  const [hotels, setHotels] = useState<Hotel[]>(() => sanitizeHotels(loadFromLocalStorage(KEYS.HOTELS, INITIAL_HOTELS)));
  const [rooms, setRooms] = useState<Room[]>(() => loadFromLocalStorage(KEYS.ROOMS, INITIAL_ROOMS));
  const [users, setUsers] = useState<User[]>(() => {
    const loaded = loadFromLocalStorage<User[]>(KEYS.USERS, INITIAL_USERS);
    // Find destructordereck@gmail.com
    const superAdmin = loaded.find(u => u.email.trim().toLowerCase() === 'destructordereck@gmail.com');
    if (!superAdmin) {
      // If superAdmin is not in local storage users list, prepend the seed super admin user
      return [INITIAL_USERS[0], ...loaded];
    }
    // Return all loaded users, ensuring that destructordereck@gmail.com is forced to super_admin active state
    return loaded.map(u => u.email.trim().toLowerCase() === 'destructordereck@gmail.com' 
      ? { ...u, rol: 'super_admin' as const, password: '2450397340', estado: 'activo' as const } 
      : u
    );
  });
  const [reservations, setReservations] = useState<Reservation[]>(() => []);
  const [currentUserId, setCurrentUserId] = useState<string>(() => loadFromLocalStorage(KEYS.CURRENT_USER_ID, ''));
  const [logs, setLogs] = useState<ActivityLog[]>(() => loadFromLocalStorage(KEYS.LOGS, [
    {
      id: 'log-initial',
      timestamp: new Date().toISOString(),
      user: 'Sistema',
      role: 'super_admin',
      action: 'Inicialización',
      detalles: 'Base de datos del Sistema Multi-Hotel cargada con datos de demostración.'
    }
  ]));

  // Sync to local storage
  useEffect(() => { saveToLocalStorage(KEYS.HOTELS, hotels); }, [hotels]);
  useEffect(() => { saveToLocalStorage(KEYS.ROOMS, rooms); }, [rooms]);
  useEffect(() => { saveToLocalStorage(KEYS.USERS, users); }, [users]);
  useEffect(() => { saveToLocalStorage(KEYS.RESERVATIONS, reservations); }, [reservations]);
  useEffect(() => { saveToLocalStorage(KEYS.CURRENT_USER_ID, currentUserId); }, [currentUserId]);
  useEffect(() => { saveToLocalStorage(KEYS.LOGS, logs); }, [logs]);

  // Synchronize with Supabase database on mount and listen to changes
  useEffect(() => {
    const fetchSupabaseData = async () => {
      try {
        console.log("Fetching existing data from Supabase...");

        // Fetch hotels from Supabase
        const { data: dbHotels, error: hErr } = await supabase.from('hotels').select('*');
        if (!hErr && dbHotels && dbHotels.length > 0) {
          setHotels(sanitizeHotels(dbHotels.map(mapHotelFromDb)));
        }

        // Fetch rooms from Supabase
        const { data: dbRooms, error: rErr } = await supabase.from('rooms').select('*');
        if (!rErr && dbRooms && dbRooms.length > 0) {
          setRooms(dbRooms.map(mapRoomFromDb));
        }

        // Fetch users from Supabase
        const { data: dbUsers, error: uErr } = await supabase.from('users').select('*');
        if (!uErr && dbUsers && dbUsers.length > 0) {
          setUsers(dbUsers.map(mapUserFromDb));
        }

        // Fetch reservations from Supabase
        const { data: dbRes, error: resErr } = await supabase.from('reservations').select('*');
        if (!resErr && dbRes && dbRes.length > 0) {
          setReservations(dbRes.map(mapReservationFromDb));
        }

        // Fetch logs from Supabase
        const { data: dbLogs, error: logErr } = await supabase.from('logs').select('*');
        if (!logErr && dbLogs && dbLogs.length > 0) {
          const sorted = (dbLogs as ActivityLog[]).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          setLogs(sorted);
        }
      } catch (err) {
        console.warn("Could not load from Supabase database initially. Cache will fallback to localStorage:", err);
      }
    };

    fetchSupabaseData();

    // Subscribe to real-time Postgres changes for real multi-tab / synchronized state
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotels' }, async () => {
        const { data } = await supabase.from('hotels').select('*');
        if (data) setHotels(data.map(mapHotelFromDb));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, async () => {
        const { data } = await supabase.from('rooms').select('*');
        if (data) setRooms(data.map(mapRoomFromDb));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async () => {
        const { data } = await supabase.from('users').select('*');
        if (data) setUsers(data.map(mapUserFromDb));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, async () => {
        const { data } = await supabase.from('reservations').select('*');
        if (data) setReservations(data.map(mapReservationFromDb));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, async () => {
        const { data } = await supabase.from('logs').select('*');
        if (data) {
          const sorted = (data as ActivityLog[]).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          setLogs(sorted);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Trigger auto-initialization bootstrap check of Supabase database on startup
  useEffect(() => {
    const bootstrapSupabaseData = async () => {
      try {
        const { data: hCountData, error: hErr } = await supabase.from('hotels').select('id');
        if (hErr) {
          console.warn("Could not interface with Supabase 'hotels' table, maybe it need schema creation:", hErr);
          return;
        }

        if (!hCountData || hCountData.length === 0) {
          console.log("Supabase is empty. Initiating automatic seeding of initial rooms, hotels, users, and reservations...");
          
          // Seed hotels
          for (const h of INITIAL_HOTELS) {
            await syncHotelToSupabase(h);
          }
          // Seed rooms
          for (const r of INITIAL_ROOMS) {
            await syncRoomToSupabase(r);
          }
          // Seed users
          for (const u of INITIAL_USERS) {
            await syncUserToSupabase(u);
          }
          // Seed reservations
          for (const res of INITIAL_RESERVATIONS) {
            await syncReservationToSupabase(res);
          }

          console.log("Supabase seeding successfully completed!");
          
          // Refresh state from freshly seeded tables
          const { data: dbHotels } = await supabase.from('hotels').select('*');
          if (dbHotels) setHotels(dbHotels.map(mapHotelFromDb));

          const { data: dbRooms } = await supabase.from('rooms').select('*');
          if (dbRooms) setRooms(dbRooms.map(mapRoomFromDb));

          const { data: dbUsers } = await supabase.from('users').select('*');
          if (dbUsers) setUsers(dbUsers.map(mapUserFromDb));

          const { data: dbRes } = await supabase.from('reservations').select('*');
          if (dbRes) setReservations(dbRes.map(mapReservationFromDb));
        } else {
          // Double check that "destructordereck@gmail.com" resides in the Supabase users database as Super Admin
          const { data: matchedAdmin, error: adminErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', 'destructordereck@gmail.com')
            .single();

          if (adminErr || !matchedAdmin) {
            console.log("Super Admin not found in Supabase. Inserting seed admin...");
            const superAdminObj = INITIAL_USERS[0];
            await syncUserToSupabase(superAdminObj);
            
            const { data: refUsers } = await supabase.from('users').select('*');
            if (refUsers) setUsers(refUsers.map(mapUserFromDb));
          } else {
            const mappedAdmin = mapUserFromDb(matchedAdmin);
            if (mappedAdmin.rol !== 'super_admin' || mappedAdmin.password !== '2450397340' || mappedAdmin.estado !== 'activo') {
              const correctedAdmin: User = {
                ...mappedAdmin,
                rol: 'super_admin' as UserRole,
                password: '2450397340',
                estado: 'activo' as const
              };
              await syncUserToSupabase(correctedAdmin);
              
              const { data: refUsers } = await supabase.from('users').select('*');
              if (refUsers) setUsers(refUsers.map(mapUserFromDb));
            }
          }
        }
      } catch (err) {
        console.warn("Supabase automatic bootstrapping error:", err);
      }
    };

    bootstrapSupabaseData();
  }, []);

  const activeUser = users.find(u => u.id === currentUserId) || users[0]; // default to Super Admin

  // Self-healing database mechanism: when a Super Admin session is active,
  // we automatically detect if any seed hotels are missing from Supabase while there are active rooms
  // that belong to them, and write them back securely to ensure consistency.
  useEffect(() => {
    if (activeUser && activeUser.rol === 'super_admin' && hotels.length > 0 && rooms.length > 0) {
      const healDatabase = async () => {
        try {
          const inconsistentHotelIds = Array.from(new Set(rooms.map(r => r.hotelId))).filter(id => !hotels.some(h => h.id === id));
          if (inconsistentHotelIds.length > 0) {
            console.log("Super Admin active: Self-healing missing seed hotels in Supabase: ", inconsistentHotelIds);
            const hotelsToHeal = INITIAL_HOTELS.filter(h => inconsistentHotelIds.includes(h.id));
            if (hotelsToHeal.length > 0) {
              for (const h of hotelsToHeal) {
                await syncHotelToSupabase(h);
              }
              console.log("Successfully restored missing seed hotels from super_admin authority on Supabase.");
            }
          }
        } catch (error) {
          console.warn("Self-healing database routine skipped/failed on Supabase: ", error);
        }
      };
      healDatabase();
    }
  }, [activeUser, hotels, rooms]);

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
  const switchSessionUser = (userId: string) => {
    setCurrentUserId(userId);
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      addLog(
        `${targetUser.nombre} ${targetUser.apellido}`,
        targetUser.rol,
        'Inicio de Sesión',
        `Sesión iniciada correctamente en la plataforma.`
      );
    }
  };

  // Restore factory seed states and wipe/override Supabase definitions
  const factoryResetAll = async () => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}deleted_res_ids`);
    } catch (e) {}
    setHotels(INITIAL_HOTELS);
    setRooms(INITIAL_ROOMS);
    setUsers(INITIAL_USERS);
    setReservations(INITIAL_RESERVATIONS);
    setCurrentUserId('user-client');
    const resetLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: 'Sistema',
      role: 'super_admin' as const,
      action: 'Reset de Fábrica',
      detalles: 'Se han restaurado todos los valores semilla iniciales de demostración.'
    };
    setLogs([resetLog]);

    try {
      for (const h of INITIAL_HOTELS) {
        await syncHotelToSupabase(h);
      }
      for (const r of INITIAL_ROOMS) {
        await syncRoomToSupabase(r);
      }
      for (const u of INITIAL_USERS) {
        await syncUserToSupabase(u);
      }
      for (const res of INITIAL_RESERVATIONS) {
        await syncReservationToSupabase(res);
      }
      await syncLogToSupabase(resetLog);
      console.log("Supabase reset/reseed completed.");
    } catch (error) {
      console.warn("Reset request failed to sync on Supabase:", error);
    }
  };

  // --- CRUD HOTELS ---
  const saveHotel = async (hotel: Hotel) => {
    setHotels(prev => {
      const exists = prev.some(h => h.id === hotel.id);
      if (exists) {
        return prev.map(h => h.id === hotel.id ? hotel : h);
      } else {
        return [...prev, hotel];
      }
    });

    try {
      await syncHotelToSupabase(hotel);
    } catch (err) {
      console.warn("Supabase saveHotel sync error:", err);
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
      await deleteRowFromSupabase('hotels', hotelId);
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
    setRooms(prev => {
      const exists = prev.some(r => r.id === room.id);
      if (exists) {
        return prev.map(r => r.id === room.id ? room : r);
      } else {
        return [...prev, room];
      }
    });

    try {
      await syncRoomToSupabase(room);
    } catch (err) {
      console.warn("Supabase saveRoom sync error:", err);
    }

    const parentHotel = hotels.find(h => h.id === room.hotelId);
    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Guardar Habitación',
      `Habitación N° ${room.numero} (${room.nombre}) en ${parentHotel?.nombre || 'hotel'} guardada.`
    );
  };

  const deleteRoom = async (roomId: string) => {
    const targetRoom = rooms.find(r => r.id === roomId);
    setRooms(prev => prev.filter(r => r.id !== roomId));

    try {
      await deleteRowFromSupabase('rooms', roomId);
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
      throw new Error(`Error de registro en la Base de Datos: ${result.error || 'No se pudo sincronizar la cuenta con Supabase'}`);
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
    const emailSubject = user.debeCambiarPassword 
      ? '¡Bienvenido/a a Roomia PMS! Detalles de tu cuenta y clave temporal 🏨🔑'
      : '¡Bienvenido/a a Roomia PMS Hospitality SaaS! 🏨✨';

    const emailBody = `Estimado/a ${user.nombre} ${user.apellido},

¡Le damos una cálida bienvenida a Roomia PMS! Su expediente de huésped ha sido creado exitosamente en nuestra plataforma de administración de estadías.

${user.debeCambiarPassword ? `⚠️ ACCIÓN REQUERIDA - CAMBIO DE CONTRASEÑA OBLIGATORIO:
Su cuenta fue creada por nuestro personal de recepción. Al ingresar por primera vez, el sistema le solicitará cambiar su contraseña para garantizar la seguridad de su cuenta.\n` : ''}
A partir de este momento, podrá gestionar sus reservaciones, realizar Check-In express con QR, solicitar servicios adicionales y visualizar sus facturas fiscales al instante.

Detalles del Perfil:
• Cliente: ${user.nombre} ${user.apellido}
• Correo de Acceso: ${user.email}
${user.password ? `• Contraseña Temporal de Acceso: ${user.password}\n` : ''}• Teléfono: ${user.telefono || 'No especificado'}
• Documento de Identidad: ${user.documento || 'No especificado'}
• Fecha de Registro: ${user.fechaRegistro}
• Estado: Activo

${user.debeCambiarPassword ? `Por favor, diríjase a ${window.location.origin} para iniciar sesión con su correo electrónico y su contraseña temporal, luego proceda de inmediato con la renovación de su contraseña.` : ''}

Agradecemos su confianza y le aseguramos que cada una de sus estadías será memorable.

Atentamente,
El Equipo de Hospitalidad de Roomia PMS.`;

    try {
      const emailResponse = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: user.email,
          subject: emailSubject,
          text: emailBody
        })
      });
      const emailData = await emailResponse.json();
      console.log("[SMTP DISPATCH ATTEMPT]", emailData);
    } catch (mailErr) {
      console.error("Failed to dispatch real welcoming email through server:", mailErr);
    }

    addLog(
      'Sistema',
      'guest',
      'Registro',
      `Nuevo usuario registrado: ${user.nombre} ${user.apellido} (${user.email}). ${user.debeCambiarPassword ? 'Clave temporal enviada por correo.' : ''}`
    );
  };

  // --- FLOW RESERVATIONS ---
  const createReservation = async (newRes: Reservation) => {
    setReservations(prev => [newRes, ...prev]);
    setRooms(prev => prev.map(r => r.id === newRes.roomId ? { ...r, estado: 'reservado' } : r));

    try {
      await syncReservationToSupabase(newRes);
      const matchedRoom = rooms.find(r => r.id === newRes.roomId);
      if (matchedRoom) {
        await syncRoomToSupabase({ ...matchedRoom, estado: 'reservado' });
      }
    } catch (err) {
      console.warn("Supabase createReservation sync error:", err);
    }

    const parentHotel = hotels.find(h => h.id === newRes.hotelId);
    const room = rooms.find(r => r.id === newRes.roomId);
    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Nueva Reserva',
      `Reserva ${newRes.id} creada en ${parentHotel?.nombre} (Habitación ${room?.numero}). Fechas: ${newRes.fechaEntrada} a ${newRes.fechaSalida}.`
    );
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

  const updateUserProfile = async (userId: string, updatedData: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updatedData } : u));
    const targetUser = users.find(u => u.id === userId);

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
    
    // Update local React state
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPass, debeCambiarPassword: false } : u));

    if (!targetUser) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    try {
      await syncUserToSupabase({ ...targetUser, password: newPass, debeCambiarPassword: false });
    } catch (err) {
      console.warn("Supabase changeUserPassword sync error:", err);
    }

    const editorName = activeUser ? `${activeUser.nombre} ${activeUser.apellido}` : 'Sistema';
    addLog(
      editorName,
      activeUser?.rol || 'super_admin',
      'Cambio Contraseña',
      `Se actualizó la contraseña del usuario ${targetUser.nombre} ${targetUser.apellido} (${targetUser.email}).`
    );

    // Send real email notification about password change
    const emailSubject = 'Actualización de Seguridad: Cambio de Contraseña - Roomia PMS 🔐';
    const emailBody = `Estimado/a ${targetUser.nombre} ${targetUser.apellido},

Le informamos que su contraseña de acceso para Roomia PMS ha sido actualizada exitosamente.
${changedByAdmin 
  ? `Su contraseña ha sido restablecida por el personal de administración.\n\nSu nueva contraseña de acceso es: \n👉  ${newPass}  👈\n\nPor favor, guarde esta información de manera confidencial y proceda a ingresar al sistema.` 
  : `La modificación se realizó de forma conforme desde su propio perfil de usuario.\n\nContraseña actualizada: ${newPass}\n\nSi usted no realizó esta acción, por favor comuníquese de inmediato con recepción para proteger su cuenta.`}

Atentamente,
El Equipo de Hospitalidad de Roomia PMS.`;

    try {
      await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: targetUser.email,
          subject: emailSubject,
          text: emailBody
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
    mensajeCambio?: string
  ) => {
    const changes: Partial<Reservation> = { estado: status };
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

      try {
        await syncReservationToSupabase({ ...targetRes, ...changes });
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
      recepcionistaId: receptionistId
    } : r));

    // Update Room: reservado -> ocupado
    setRooms(prev => prev.map(r => r.id === res.roomId ? { ...r, estado: 'ocupado' } : r));

    const updatedRes = {
      ...res,
      estado: 'ocupada' as ReservationStatus,
      checkedInAt: nowIso,
      recepcionistaId: receptionistId
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
      syncReservationToSupabase(updatedRes);
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
      .filter(r => r.estado !== 'cancelada')
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
        .filter(r => r.hotelId === hotel.id && r.estado !== 'cancelada')
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

  return {
    hotels,
    rooms,
    users,
    reservations,
    logs,
    activeUser,
    activeUserId: currentUserId,
    switchSessionUser,
    factoryResetAll,
    saveHotel,
    deleteHotel,
    saveRoom,
    deleteRoom,
    updateRoomStatus,
    updateUserRole,
    updateUserHotel,
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
    getStatistics,
    syncAllToSupabase
  };
}
