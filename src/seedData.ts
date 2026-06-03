/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Room, User, Reservation } from './types';

export const INITIAL_HOTELS: Hotel[] = [];

export const INITIAL_ROOMS: Room[] = [];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-superadmin',
    nombre: 'Dereck',
    apellido: 'Cisneros',
    email: 'destructordereck@gmail.com',
    telefono: '0998596597',
    documento: '2450397340',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    rol: 'super_admin',
    fechaRegistro: '2026-06-03',
    estado: 'activo',
    password: '2450397340'
  }
];

export const INITIAL_RESERVATIONS: Reservation[] = [];
