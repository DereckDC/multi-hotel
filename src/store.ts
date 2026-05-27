/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Hotel, Room, User, Reservation, RoomStatus, ReservationStatus, UserRole } from './types';
import { INITIAL_HOTELS, INITIAL_ROOMS, INITIAL_USERS, INITIAL_RESERVATIONS } from './seedData';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  getDocs, 
  query, 
  limit 
} from 'firebase/firestore';
import {
  syncHotelToSupabase,
  syncRoomToSupabase,
  syncUserToSupabase,
  syncReservationToSupabase,
  syncLogToSupabase,
  deleteRowFromSupabase
} from './supabase';

// Safe standard local storage storage key constants
const STORAGE_PREFIX = 'aura_hotel_pms_';
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

export function useHotelStore() {
  const [hotels, setHotels] = useState<Hotel[]>(() => loadFromLocalStorage(KEYS.HOTELS, INITIAL_HOTELS));
  const [rooms, setRooms] = useState<Room[]>(() => loadFromLocalStorage(KEYS.ROOMS, INITIAL_ROOMS));
  const [users, setUsers] = useState<User[]>(() => {
    const loaded = loadFromLocalStorage<User[]>(KEYS.USERS, INITIAL_USERS);
    const filtered = loaded.filter(u => u.email.trim().toLowerCase() === 'destructordereck@gmail.com');
    if (filtered.length === 0) return INITIAL_USERS;
    return filtered.map(u => ({ ...u, rol: 'super_admin', password: '2450397340', estado: 'activo' }));
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

  // Real-time synchronization list of Firestore database snapshot triggers
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const initializeFirestoreListeners = () => {
      // 1. Listen for Hotels (Publicly readable)
      const unsubHotels = onSnapshot(collection(db, 'hotels'), (snapshot) => {
        const cloudHotels: Hotel[] = [];
        snapshot.forEach(d => {
          cloudHotels.push(d.data() as Hotel);
        });
        if (cloudHotels.length > 0) {
          setHotels(cloudHotels);
        }
      }, (error) => {
        console.warn("Hotels onSnapshot restricted by secure rules; using local cache: ", error.message);
      });
      unsubscribes.push(unsubHotels);

      // 2. Listen for Rooms (Publicly readable)
      const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
        const cloudRooms: Room[] = [];
        snapshot.forEach(d => {
          cloudRooms.push(d.data() as Room);
        });
        if (cloudRooms.length > 0) {
          setRooms(cloudRooms);
        }
      }, (error) => {
        console.warn("Rooms onSnapshot restricted; using local cache: ", error.message);
      });
      unsubscribes.push(unsubRooms);

      // 3. Listen for Users (Read rules apply: signed-in users only)
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const cloudUsers: User[] = [];
        snapshot.forEach(d => {
          cloudUsers.push(d.data() as User);
        });
        if (cloudUsers.length > 0) {
          setUsers(cloudUsers);
        }
      }, (error) => {
        console.log("Users onSnapshot read limited by Attribute-Based security rules.");
      });
      unsubscribes.push(unsubUsers);

      // 4. Listen for Reservations
      const unsubReservations = onSnapshot(collection(db, 'reservations'), (snapshot) => {
        const cloudReservations: Reservation[] = [];
        snapshot.forEach(d => {
          cloudReservations.push(d.data() as Reservation);
        });
        if (cloudReservations.length > 0) {
          setReservations(cloudReservations);
        }
      }, (error) => {
        console.log("Reservations reading restricted for current user session.");
      });
      unsubscribes.push(unsubReservations);

      // 5. Listen for Audit Logs (Staff-only readable)
      const unsubLogs = onSnapshot(collection(db, 'logs'), (snapshot) => {
        const cloudLogs: ActivityLog[] = [];
        snapshot.forEach(d => {
          cloudLogs.push(d.data() as ActivityLog);
        });
        if (cloudLogs.length > 0) {
          cloudLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          setLogs(cloudLogs);
        }
      }, (error) => {
        console.log("Audit log monitoring read restricted.");
      });
      unsubscribes.push(unsubLogs);
    };

    initializeFirestoreListeners();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  // Trigger auto-initialization bootstrap check of Firestore on startup
  useEffect(() => {
    const bootstrapFirestoreData = async () => {
      try {
        const hSnap = await getDocs(collection(db, 'hotels'));
        const existingIds = new Set(hSnap.docs.map(doc => doc.id));
        let seededAny = false;

        // Verify and write any missing initial/seed hotels
        for (const h of INITIAL_HOTELS) {
          if (!existingIds.has(h.id)) {
            await setDoc(doc(db, 'hotels', h.id), h);
            seededAny = true;
          }
        }

        // Verify and write any missing initial/seed rooms
        const rSnap = await getDocs(collection(db, 'rooms'));
        const existingRoomIds = new Set(rSnap.docs.map(doc => doc.id));
        for (const r of INITIAL_ROOMS) {
          if (!existingRoomIds.has(r.id)) {
            await setDoc(doc(db, 'rooms', r.id), r);
            seededAny = true;
          }
        }

        // Clean user database in Firestore: only leave "destructordereck@gmail.com"
        const uSnap = await getDocs(collection(db, 'users'));
        let hasSuperAdmin = false;
        for (const docObj of uSnap.docs) {
          const userData = docObj.data() as User;
          if (userData.email.trim().toLowerCase() !== 'destructordereck@gmail.com') {
            await deleteDoc(doc(db, 'users', docObj.id));
            seededAny = true;
          } else {
            hasSuperAdmin = true;
            if (userData.rol !== 'super_admin' || userData.password !== '2450397340' || userData.estado !== 'activo') {
              await setDoc(doc(db, 'users', docObj.id), {
                ...userData,
                rol: 'super_admin',
                password: '2450397340',
                estado: 'activo'
              });
              seededAny = true;
            }
          }
        }

        if (!hasSuperAdmin) {
          const superAdminSeed = INITIAL_USERS[0];
          await setDoc(doc(db, 'users', superAdminSeed.id), superAdminSeed);
          seededAny = true;
        }

        // Wipe all client reservations in Firestore to keep everything entirely clean
        const resSnap = await getDocs(collection(db, 'reservations'));
        for (const resDoc of resSnap.docs) {
          await deleteDoc(doc(db, 'reservations', resDoc.id));
          seededAny = true;
        }

        if (seededAny) {
          console.log("Cloud Firestore database cleaned and auto-seed check executed successfully.");
        }
      } catch (err) {
        console.log("Firebase auto-seeding/clearing skipped or restricted by access permissions.", err);
      }
    };
    bootstrapFirestoreData();
  }, []);

  const activeUser = users.find(u => u.id === currentUserId) || users[0]; // default to Super Admin

  // Self-healing database mechanism: when a Super Admin session is active,
  // we automatically detect if any seed hotels are missing from Firestore while there are active rooms
  // that belong to them, and write them back securely to ensure consistency.
  useEffect(() => {
    if (activeUser && activeUser.rol === 'super_admin' && db && hotels.length > 0 && rooms.length > 0) {
      const healDatabase = async () => {
        try {
          const inconsistentHotelIds = Array.from(new Set(rooms.map(r => r.hotelId))).filter(id => !hotels.some(h => h.id === id));
          if (inconsistentHotelIds.length > 0) {
            console.log("Super Admin active: Self-healing missing seed hotels in Cloud Firestore: ", inconsistentHotelIds);
            const hotelsToHeal = INITIAL_HOTELS.filter(h => inconsistentHotelIds.includes(h.id));
            if (hotelsToHeal.length > 0) {
              for (const h of hotelsToHeal) {
                await setDoc(doc(db, 'hotels', h.id), h);
              }
              console.log("Successfully restored missing seed hotels from super_admin authority.");
            }
          }
        } catch (error) {
          console.warn("Self-healing database routine skipped/failed: ", error);
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
      await setDoc(doc(db, 'logs', newLog.id), newLog);
    } catch (e) {
      // Quietly skip for client updates
    }

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

  // Restore factory seed states and wipe/override Cloud Firestore definitions if SuperAdmin has permission
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
      role: 'super_admin',
      action: 'Reset de Fábrica',
      detalles: 'Se han restaurado todos los valores semilla iniciales de demostración.'
    };
    setLogs([resetLog]);

    try {
      for (const h of INITIAL_HOTELS) {
        await setDoc(doc(db, 'hotels', h.id), h);
      }
      for (const r of INITIAL_ROOMS) {
        await setDoc(doc(db, 'rooms', r.id), r);
      }
      for (const u of INITIAL_USERS) {
        await setDoc(doc(db, 'users', u.id), u);
      }
      for (const res of INITIAL_RESERVATIONS) {
        await setDoc(doc(db, 'reservations', res.id), res);
      }
      await setDoc(doc(db, 'logs', resetLog.id), resetLog);
      console.log("Firestore reset/reseed completed.");
    } catch (error) {
      console.warn("Unauthenticated reset request bypassed locally but rejected on Cloud server.");
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
      await setDoc(doc(db, 'hotels', hotel.id), hotel);
    } catch (error) {
      console.warn("Firestore saveHotel rejected:", error);
    }

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

    // Firestore delete hotel
    try {
      await deleteDoc(doc(db, 'hotels', hotelId));
    } catch (error) {
      console.warn("Firestore deleteHotel rejected:", error);
    }

    // Supabase delete hotel
    try {
      await deleteRowFromSupabase('hotels', hotelId);
    } catch (err) {
      console.warn("Supabase deleteHotel error:", err);
    }

    // Firestore delete associated rooms
    for (const room of roomsToDelete) {
      try {
        await deleteDoc(doc(db, 'rooms', room.id));
      } catch (err) {
        console.warn(`Firestore deleteRoom for room ${room.id} failed:`, err);
      }
      try {
        await deleteRowFromSupabase('rooms', room.id);
      } catch (err) {
        console.warn(`Supabase deleteRoom for room ${room.id} failed:`, err);
      }
    }

    // Firestore unlink associated admins/receptionists
    for (const u of usersToUnlink) {
      const updatedUser = { ...u, hotelId: undefined };
      try {
        await updateDoc(doc(db, 'users', u.id), { hotelId: null });
      } catch (err) {
        console.warn(`Firestore updateDoc for user ${u.id} unlink hotel failed:`, err);
        try {
          await setDoc(doc(db, 'users', u.id), { ...u, hotelId: null });
        } catch (e) {
          console.warn(`Fallback setDoc for user ${u.id} failed:`, e);
        }
      }
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
      await setDoc(doc(db, 'rooms', room.id), room);
    } catch (error) {
      console.warn("Firestore saveRoom rejected:", error);
    }

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
      await deleteDoc(doc(db, 'rooms', roomId));
    } catch (error) {
      console.warn("Firestore deleteRoom rejected:", error);
    }

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
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));
    const target = users.find(u => u.id === userId);

    try {
      await updateDoc(doc(db, 'users', userId), { rol: newRole });
    } catch (error) {
      if (target) {
        try {
          await setDoc(doc(db, 'users', userId), { ...target, rol: newRole });
        } catch (e) {
          console.warn("Firestore updateUserRole alternative set rejected:", e);
        }
      }
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Privilegios Modificados',
      `Se modificó el rol de ${target?.nombre} ${target?.apellido} a [${newRole.toUpperCase()}]`
    );
  };

  const updateUserHotel = async (userId: string, hotelId: string | undefined) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, hotelId } : u));
    const target = users.find(u => u.id === userId);

    try {
      await updateDoc(doc(db, 'users', userId), { hotelId: hotelId || null });
    } catch (error) {
      if (target) {
        try {
          await setDoc(doc(db, 'users', userId), { ...target, hotelId: hotelId || null });
        } catch (e) {
          console.warn("Firestore updateUserHotel alternative set rejected:", e);
        }
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
      await updateDoc(doc(db, 'users', userId), { estado: nextStatus });
    } catch (error) {
      try {
        await setDoc(doc(db, 'users', userId), { ...target, estado: nextStatus });
      } catch (e) {
        console.warn("Firestore toggleUserStatus rejected:", e);
      }
    }

    addLog(
      `${activeUser.nombre} ${activeUser.apellido}`,
      activeUser.rol,
      'Cambio de Estado de Usuario',
      `Usuario ${target.nombre} ${target.apellido} pasó a estar ${nextStatus.toUpperCase()}`
    );
  };

  const registerUser = async (user: User) => {
    setUsers(prev => [...prev, user]);

    try {
      await setDoc(doc(db, 'users', user.id), user);
    } catch (error) {
      console.warn("Firestore registerUser rejected:", error);
    }

    addLog(
      'Sistema',
      'guest',
      'Registro',
      `Nuevo usuario registrado: ${user.nombre} ${user.apellido} (${user.email})`
    );
  };

  // --- FLOW RESERVATIONS ---
  const createReservation = async (newRes: Reservation) => {
    setReservations(prev => [newRes, ...prev]);
    setRooms(prev => prev.map(r => r.id === newRes.roomId ? { ...r, estado: 'reservado' } : r));

    try {
      await setDoc(doc(db, 'reservations', newRes.id), newRes);
      await updateDoc(doc(db, 'rooms', newRes.roomId), { estado: 'reservado' });
    } catch (error) {
      console.warn("Firestore createReservation and Room lock update rejected:", error);
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
      await updateDoc(doc(db, 'reservations', resId), { estado: 'cancelada' });
      await updateDoc(doc(db, 'rooms', targetRes.roomId), { estado: 'disponible' });
    } catch (error) {
      console.warn("Firestore cancelReservation error:", error);
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

    try {
      await updateDoc(doc(db, 'reservations', resId), { eliminadaPorCliente: true });
    } catch (error) {
      console.warn("Firestore deleteReservation soft-delete error:", error);
      if (targetRes) {
        try {
          await setDoc(doc(db, 'reservations', resId), { ...targetRes, eliminadaPorCliente: true });
        } catch (e) {
          console.warn("Fallback setDoc error in deleteReservation:", e);
        }
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

    try {
      await updateDoc(doc(db, 'users', userId), updatedData);
    } catch (error) {
      if (targetUser) {
        try {
          await setDoc(doc(db, 'users', userId), { ...targetUser, ...updatedData });
        } catch (e) {
          console.warn("Firestore updateUserProfile rejected:", e);
        }
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

    setReservations(prev => prev.map(r => r.id === resId ? { ...r, ...changes } : r));

    try {
      await updateDoc(doc(db, 'reservations', resId), changes);
    } catch (error) {
      console.warn("Firestore updateReservationStatus error:", error);
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

    try {
      await updateDoc(doc(db, 'rooms', roomId), { estado: newStatus });
    } catch (error) {
      if (targetRoom) {
        try {
          await setDoc(doc(db, 'rooms', roomId), { ...targetRoom, estado: newStatus });
        } catch (e) {
          console.warn("Firestore updateRoomStatus alternative set rejected: ", e);
        }
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
          await updateDoc(doc(db, 'reservations', res.id), updatedFields);
        } catch (e) {
          console.warn("Error updating affected reservation during room status change:", e);
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

    updateDoc(doc(db, 'reservations', resId), {
      estado: 'ocupada',
      checkedInAt: nowIso,
      recepcionistaId: receptionistId
    }).catch(error => {
      console.warn("Firestore performCheckIn error:", error);
    });

    updateDoc(doc(db, 'rooms', res.roomId), { estado: 'ocupado' }).catch(error => {
      console.warn("Firestore performCheckIn room error:", error);
    });

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

    // Update reservation
    setReservations(prev => prev.map(r => r.id === resId ? {
      ...r,
      estado: 'finalizada',
      checkedOutAt: nowIso
    } : r));

    // Update Room: ocupado -> mantenimiento
    setRooms(prev => prev.map(r => r.id === res.roomId ? { ...r, estado: 'mantenimiento' } : r));

    updateDoc(doc(db, 'reservations', resId), {
      estado: 'finalizada',
      checkedOutAt: nowIso
    }).catch(error => {
      console.warn("Firestore performCheckOut error:", error);
    });

    updateDoc(doc(db, 'rooms', res.roomId), { estado: 'mantenimiento' }).catch(error => {
      console.warn("Firestore performCheckOut room error:", error);
    });

    addLog(
      rx ? `${rx.nombre} ${rx.apellido}` : 'Recepción',
      'recepcionista',
      'Check-Out Confirmado',
      `Check-Out procesado para la reserva ${resId}. Habitación enviada a MANTENIMIENTO.`
    );

    return { success: true, msg: 'Check-Out procesado exitosamente. La habitación requiere mantenimiento higiénico.' };
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
