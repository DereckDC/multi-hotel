/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Room, User, Reservation } from './types';

export const INITIAL_HOTELS: Hotel[] = [
  {
    id: 'hotel-1',
    nombre: 'Grand Luxe Hotel Boutique',
    logo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&auto=format&fit=crop&q=80',
    portada: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&auto=format&fit=crop&q=80',
    imagenes: [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80'
    ],
    descripcion: 'Hotel boutique de lujo ubicado en el centro histórico. Ofrece suites ejecutivas, restaurant gourmet, spa internacional y salones de eventos.',
    ubicacion: 'Av. Amazonas N24-12 y Patria, Quito',
    provincia: 'Pichincha',
    ciudad: 'Quito',
    coordenadas: { lat: -0.2105, lng: -78.4892 },
    googleMapsUrl: 'https://maps.google.com',
    servicios: ['WiFi 6E Ultrawide', 'Piscina Temperada', 'Spa & Wellness', 'Restaurante Gourmet', 'Estacionamiento Privado', 'Servicio a la Habitación 24/7'],
    politicas: [
      'Check-in a partir de las 15:00',
      'Check-out hasta las 12:00',
      'No se permite fumar dentro de las instalaciones',
      'Se admiten mascotas pequeñas bajo reserva previa'
    ],
    horarios: { checkIn: '15:00', checkOut: '12:00' },
    contacto: {
      telefono: '+593 2 2500 123',
      email: 'reservas@grandluxe.com',
      web: 'https://grandluxe.com'
    },
    redesSociales: {
      instagram: '@grandluxe_hotel',
      facebook: 'GrandLuxeHotelOfficial'
    },
    estado: 'activo',
    tipoEstablecimiento: 'hotel'
  },
  {
    id: 'hotel-2',
    nombre: 'Aura Horizon Resort & Ocean Club',
    logo: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=200&auto=format&fit=crop&q=80',
    portada: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&auto=format&fit=crop&q=80',
    imagenes: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80'
    ],
    descripcion: 'Exclusivo resort frente al mar con acceso privado a la playa, infinity pool, deportes acuáticos y restaurantes de especialidad mariscos.',
    ubicacion: 'Malecón Escénico San Mateo, Manta',
    provincia: 'Manabí',
    ciudad: 'Manta',
    coordenadas: { lat: -0.9502, lng: -80.7301 },
    googleMapsUrl: 'https://maps.google.com',
    servicios: ['Acceso Privado a Playa', 'Piscina Infinity', 'Bar Frente al Mar', 'Gimnasio Equipado', 'Deportes Acuáticos', 'Desayuno Buffet Incluido'],
    politicas: [
      'Check-in a partir de las 14:00',
      'Check-out hasta las 11:00',
      'Uso obligatorio de pulsera del resort'
    ],
    horarios: { checkIn: '14:00', checkOut: '11:00' },
    contacto: {
      telefono: '+593 5 2620 456',
      email: 'info@aurahorizon.com',
      web: 'https://aurahorizon.com'
    },
    redesSociales: {
      instagram: '@aurahorizon_manta',
      facebook: 'AuraHorizonResort'
    },
    estado: 'activo',
    tipoEstablecimiento: 'hotel'
  },
  {
    id: 'prop-1',
    nombre: 'Villa Sol & Mar Pacific Front',
    logo: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200&auto=format&fit=crop&q=80',
    portada: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&auto=format&fit=crop&q=80',
    imagenes: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&auto=format&fit=crop&q=80'
    ],
    descripcion: 'Espectacular villa moderna de 4 dormitorios con piscina privada, BBQ exterior, cocina totalmente equipada y vista al océano.',
    ubicacion: 'Urbanización Mirador del Mar, Chipipe, Salinas',
    provincia: 'Santa Elena',
    ciudad: 'Salinas',
    coordenadas: { lat: -2.2155, lng: -80.9721 },
    googleMapsUrl: 'https://maps.google.com',
    servicios: ['Piscina Privada', 'BBQ Grill', 'Aire Acondicionado Central', 'Cocina Abierta Gourmet', 'Garaje para 3 Autos'],
    politicas: [
      'Mínimo de alquiler: 2 noches',
      'Capacidad máxima: 10 huéspedes',
      'Depósito de garantía reembolsable requerido'
    ],
    horarios: { checkIn: '15:00', checkOut: '12:00' },
    contacto: {
      telefono: '+593 4 2770 889',
      email: 'propiedades@salinasluxury.com'
    },
    redesSociales: {
      instagram: '@villasolmar_salinas'
    },
    estado: 'activo',
    tipoEstablecimiento: 'casa',
    finalidad: 'alquiler',
    detallesInmueble: {
      habitaciones: 4,
      banos: 4,
      metrosCuadrados: 280,
      amueblado: true,
      tieneEstacionamiento: true,
      precio: 250
    }
  },
  {
    id: 'prop-2',
    nombre: 'Penthouse View Samborondón',
    logo: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200&auto=format&fit=crop&q=80',
    portada: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=80',
    imagenes: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'
    ],
    descripcion: 'Elegante departamento tipo penthouse amoblado de 3 dormitorios con acabados de primera, terraza panorámica y garaje subterráneo doble.',
    ubicacion: 'km 2.5 Av. Samborondón, Guayaquil',
    provincia: 'Guayas',
    ciudad: 'Guayaquil',
    coordenadas: { lat: -2.1438, lng: -79.8647 },
    googleMapsUrl: 'https://maps.google.com',
    servicios: ['Seguridad Privada 24h', 'Gimnasio de Condominio', 'Terraza Panorámica', 'Aire Acondicionado Inverter', 'Internet Fibra Óptica 500MB'],
    politicas: [
      'Prohibido eventos masivos',
      'Reglamento de convivencia del edificio obligatorio'
    ],
    horarios: { checkIn: '15:00', checkOut: '12:00' },
    contacto: {
      telefono: '+593 4 2830 990',
      email: 'arriendos@samborondonrealestate.ec'
    },
    redesSociales: {
      instagram: '@penthouse_sambo'
    },
    estado: 'activo',
    tipoEstablecimiento: 'departamento',
    finalidad: 'alquiler',
    detallesInmueble: {
      habitaciones: 3,
      banos: 3,
      metrosCuadrados: 195,
      amueblado: true,
      tieneEstacionamiento: true,
      precio: 180
    }
  }
];

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-101',
    hotelId: 'hotel-1',
    numero: '101',
    nombre: 'Suite Presidencial Panorama',
    descripcion: 'Espaciosa suite de lujo con cama King Size, sala de estar independiente, balcón con vista a las montañas, tina de hidromasaje y amenities exclusivos.',
    precio: 180,
    capacidad: 2,
    camas: 1,
    tipo: 'Suite Presidencial',
    imagenes: [
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Tina de Hidromasaje', 'Cama King Size', 'Smart TV 65"', 'Minibar de Cortesía', 'Balcón Privado', 'Caja Fuerte Electrónica'],
    estado: 'disponible',
    adicionarIva: true
  },
  {
    id: 'room-102',
    hotelId: 'hotel-1',
    numero: '102',
    nombre: 'Habitación Deluxe King',
    descripcion: 'Habitación moderna con excelente iluminación natural, escritorio de trabajo ergonómico, baño de mármol con ducha tipo lluvia y climatizador.',
    precio: 120,
    capacidad: 2,
    camas: 1,
    tipo: 'Suite',
    imagenes: [
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Escritorio Ejecutivo', 'WiFi de Alta Velocidad', 'Ducha Tipo Lluvia', 'Cafetera Espresso'],
    estado: 'disponible',
    adicionarIva: true
  },
  {
    id: 'room-103',
    hotelId: 'hotel-1',
    numero: '103',
    nombre: 'Habitación Doble Superior',
    descripcion: 'Ideal para viajes de negocios o pequeños grupos. Equipada con 2 camas Queen Size, climatizador silencioso y vista a los jardines interiores.',
    precio: 95,
    capacidad: 4,
    camas: 2,
    tipo: 'Doble',
    imagenes: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['2 Camas Queen', 'Caja Fuerte', 'Secador de Cabello', 'TV por Cable HD'],
    estado: 'disponible',
    adicionarIva: true
  },
  {
    id: 'room-201',
    hotelId: 'hotel-2',
    numero: '201',
    nombre: 'Oceanfront Sunset Villa',
    descripcion: 'Cabaña independiente sobre la colina con vista directa al mar, terraza privada con hamaca, cama King Size y ducha exterior tropical.',
    precio: 160,
    capacidad: 2,
    camas: 1,
    tipo: 'Suite Presidencial',
    imagenes: [
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Terraza con Hamaca', 'Vista Directa al Mar', 'Servicio de Desayuno a la Habitación', 'Bocinas Bluetooth'],
    estado: 'disponible',
    adicionarIva: true
  },
  {
    id: 'room-202',
    hotelId: 'hotel-2',
    numero: '202',
    nombre: 'Suite Tropical Beach',
    descripcion: 'Amplia suite a pasos de la arena. Cuenta con cama King Size, sofá cama abatible, minibar refrigerado y aire acondicionado split.',
    precio: 110,
    capacidad: 3,
    camas: 2,
    tipo: 'Suite',
    imagenes: [
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Acceso Directo a Playa', 'Aire Acondicionado', 'Minibar', 'Caja de Seguridad'],
    estado: 'disponible',
    adicionarIva: true
  }
];

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
    estado: 'activo'
  }
];

export const INITIAL_RESERVATIONS: Reservation[] = [];
