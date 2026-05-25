/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Room, User, Reservation } from './types';

export const INITIAL_HOTELS: Hotel[] = [
  {
    id: 'hotel-1',
    nombre: 'Aura Majestic Palace',
    logo: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=150&auto=format&fit=crop&q=80',
    portada: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop&q=80',
    imagenes: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80'
    ],
    descripcion: 'Ubicado en el corazón de la zona colonial, Aura Majestic Palace combina el lujo clásico europeo con un servicio boutique exclusivo. Disfrute de nuestra emblemática piscina infinita de borde de cristal, restaurante galardonado con estrella Michelin y tratamientos de spa personalizados de última generación.',
    ubicacion: 'Paseo de la Reforma 450, Ciudad de México, México',
    coordenadas: { lat: 19.4273, lng: -99.1676 },
    googleMapsUrl: 'https://maps.google.com/maps?q=Paseo+de+la+Reforma+450,+Ciudad+de+M%C3%A9xico',
    servicios: ['Piscina Infinita', 'Restaurante Gourmet', 'Servicio de Concierge 24/7', 'Spa de Lujo', 'Gimnasio Equipado', 'Estacionamiento Premium Valet', 'Wi-Fi de Alta Velocidad', 'Café Filtro'],
    politicas: [
      'Check-in: A partir de las 15:00',
      'Check-out: Hasta las 12:00',
      'Política de cancelación gratuita hasta 24 horas antes del arribo.',
      'No se admiten mascotas.',
      'Establecimiento 100% libre de humo.'
    ],
    horarios: {
      checkIn: '15:00',
      checkOut: '12:00'
    },
    contacto: {
      telefono: '+52 55 5000 4000',
      email: 'reservaciones@auramajestic.com',
      web: 'www.auramajesticpalace.com'
    },
    redesSociales: {
      facebook: 'facebook.com/auramajestic',
      instagram: 'instagram.com/auramajestic'
    },
    estado: 'activo'
  },
  {
    id: 'hotel-2',
    nombre: 'Plaza Nómada Urban Oasis',
    logo: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=150&auto=format&fit=crop&q=80',
    portada: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&auto=format&fit=crop&q=80',
    imagenes: [
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80'
    ],
    descripcion: 'Diseñado para profesionales modernos, viajeros creativos y almas nómadas. Un santuario urbano rodeado de vegetación tropical sumergido en el pulmón financiero. Conectividad WiFi 6E ultra rápida, salas de co-working creativas, terrazas ajardinadas con bar de autor y desayunos locales orgánicos.',
    ubicacion: 'Calle de Serrano 84, Barrio de Salamanca, Madrid, España',
    coordenadas: { lat: 40.4320, lng: -3.6872 },
    googleMapsUrl: 'https://maps.google.com/maps?q=Calle+de+Serrano+84,+Madrid,+Espa%C3%B1a',
    servicios: ['Co-working Space', 'Piscina Climatizada', 'Terrazas Jardín', 'Café de Especialidad', 'Bar de Cócteles de Autor', 'Pet Friendly', 'Bicicletas Gratuitas'],
    politicas: [
      'Check-in: A partir de las 14:00',
      'Check-out: Hasta las 11:00',
      'Se admiten mascotas con cargo adicional.',
      'Desayuno incluido en reservas directas.',
      'Establecimiento amigable con el medio ambiente.'
    ],
    horarios: {
      checkIn: '14:00',
      checkOut: '11:00'
    },
    contacto: {
      telefono: '+34 91 700 800',
      email: 'host@plazanomada.com',
      web: 'www.plazanomada.com'
    },
    redesSociales: {
      instagram: 'instagram.com/plazanomadahotels',
      twitter: 'twitter.com/plazanomada'
    },
    estado: 'activo'
  },
  {
    id: 'hotel-3',
    nombre: 'Eco-Cabin Wildwood Shore',
    logo: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=150&auto=format&fit=crop&q=80',
    portada: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&auto=format&fit=crop&q=80',
    imagenes: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1504643971488-5a2aa684be43?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80'
    ],
    descripcion: 'Privacidad absoluta a orillas del majestuoso lago glaciar. Cabañas ecológicas de madera noble y ventanales panorámicos de triple panel que ofrecen vistas espectaculares de las montañas boscosas. Calefacción geotérmica, jacuzzis exteriores de uso privado y muelle exclusivo con kayaks.',
    ubicacion: 'Ruta Costera Km 14, Bariloche, Patagonia, Argentina',
    coordenadas: { lat: -41.1335, lng: -71.3103 },
    googleMapsUrl: 'https://maps.google.com/maps?q=Ruta+Costera+Km+14,+Bariloche,+Argentina',
    servicios: ['Muelle Privado', 'Jacuzzi Exterior Autónomo', 'Kayaks & Paddle Boards', 'Chimenea de Leña', 'Estación de Carga EV', 'Eco-Tours Auto-guiados', 'Desayuno de Campo en Puerta'],
    politicas: [
      'Check-in: A partir de las 16:00',
      'Check-out: Hasta las 10:00',
      'Depósito reembolsable de garantía requerido al check-in.',
      'Sustentabilidad garantizada: energía solar e hídrica propia.',
      'Apto para niños mayores de 12 años.'
    ],
    horarios: {
      checkIn: '16:00',
      checkOut: '10:00'
    },
    contacto: {
      telefono: '+54 294 456 789',
      email: 'explore@wildwoodshores.com',
      web: 'www.wildwoodshores.com'
    },
    redesSociales: {
      facebook: 'facebook.com/wildwoodshores',
      instagram: 'instagram.com/wildwoodpatagonia'
    },
    estado: 'activo'
  }
];

export const INITIAL_ROOMS: Room[] = [
  // Hotel 1 Rooms
  {
    id: 'room-101',
    hotelId: 'hotel-1',
    numero: '101',
    nombre: 'Deluxe Suite Imperial',
    descripcion: 'Hermosa habitación con sábanas de algodón egipcio de 600 hilos, baño de mármol de Carrara italiano, ducha de efecto lluvia, minibar gourmet y balcón privado al Paseo de la Reforma.',
    precio: 250,
    capacidad: 2,
    camas: 1,
    tipo: 'Suite',
    imagenes: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Cama King-Size', 'Baño de Mármol', 'Balcón Central', 'Minibar Premium', 'Cafetera Nespresso', 'Smart TV 65"'],
    estado: 'disponible'
  },
  {
    id: 'room-102',
    hotelId: 'hotel-1',
    numero: '102',
    nombre: 'Gran Suite Familiar Presidencial',
    descripcion: 'El pináculo del espacio y confort. Consta de dos dormitorios amplios en suite, salón comedor para 6 comensales, cocina de mayordomo y el más alto nivel de automatización residencial mediante tablets integradas.',
    precio: 480,
    capacidad: 5,
    camas: 3,
    tipo: 'Suite Presidencial',
    imagenes: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['2 Dormitorios', 'Salón Comedor', 'Smart Automation', 'Vistas de 180 Grados', 'Bañera de Hidromasaje', 'Mayordomo Asignado'],
    estado: 'ocupado'
  },
  {
    id: 'room-103',
    hotelId: 'hotel-1',
    numero: '103',
    nombre: 'Clásica Superior Doble',
    descripcion: 'Cómoda habitación de estilo neoclásico con espléndidos armarios empotrados, mesa de escritorio ejecutiva de caoba y dos hermosas camas dobles ideales para viajes de negocios o exploración familiar.',
    precio: 180,
    capacidad: 4,
    camas: 2,
    tipo: 'Doble',
    imagenes: [
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Dos Camas Queen', 'Mesa de Trabajo', 'Aire Acondicionado Inteligente', 'Caja Fuerte', 'Ducha de Alta Presión'],
    estado: 'disponible'
  },
  {
    id: 'room-104',
    hotelId: 'hotel-1',
    numero: '104',
    nombre: 'Boutique Individual Estándar',
    descripcion: 'Optimización perfecta del espacio sin escatimar confort. Una reconfortante cama nido de plaza y media, detalles arquitectónicos artesanales locales, y la luz cálida de la mañana ideal para relajarse.',
    precio: 120,
    capacidad: 1,
    camas: 1,
    tipo: 'Estándar',
    imagenes: [
      'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Cama Matrimonial Individual', 'Ducha Lluvia', 'Espacio Funcional', 'Cafetera In-room'],
    estado: 'mantenimiento'
  },

  // Hotel 2 Rooms
  {
    id: 'room-201',
    hotelId: 'hotel-2',
    numero: '201',
    nombre: 'Nómada Premium Studio',
    descripcion: 'Estudio de estilo industrial chic con techos altos de hormigón a la vista. Zona de oficina dedicada con escritorio ergonómico Steelcase, pizarra de cristal magnética y cafetera drip de goteo japonesa.',
    precio: 150,
    capacidad: 2,
    camas: 1,
    tipo: 'Suite',
    imagenes: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Escritorio Ergonómico', 'Silla de Oficina Ejecutiva', 'Monitor Ultrawide 34"', 'Pizarra de Cristal', 'Wi-Fi 6E Premium'],
    estado: 'disponible'
  },
  {
    id: 'room-202',
    hotelId: 'hotel-2',
    numero: '202',
    nombre: 'Estándar Coworking Doble',
    descripcion: 'Diseñada para equipos o duplas creativas. Dispone de dos camas individuales premium, escritorios modulares desplazables independientes y cargadores de USB e inalámbricos de última velocidad integrados.',
    precio: 130,
    capacidad: 2,
    camas: 2,
    tipo: 'Doble',
    imagenes: [
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Camas Ajustables', 'Conectividad Multipunto', 'Baño Compartimentado', 'Puerta Insonorizada'],
    estado: 'reservado'
  },
  {
    id: 'room-203',
    hotelId: 'hotel-2',
    numero: '203',
    nombre: 'Urban Suite Loft',
    descripcion: 'Un loft de dos niveles con sala de estar de diseño escandinavo en la planta baja y el dormitorio principal en el altillo. Paredes de ladrillo visto original y grandes ventanales con vistas panorámicas al skyline de Madrid.',
    precio: 210,
    capacidad: 3,
    camas: 2,
    tipo: 'Suite',
    imagenes: [
      'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Diseño en Dos Niveles', 'Sofá Cama Premium', 'Barra de Bar Privada', 'Altavoz Bluetooth Marshall', 'Vistas Panorámicas de la Ciudad'],
    estado: 'disponible'
  },

  // Hotel 3 Rooms
  {
    id: 'room-301',
    hotelId: 'hotel-3',
    numero: 'A-1',
    nombre: 'Refugio Glaciar Prime',
    descripcion: 'Espectacular cabaña al borde del lago. Techo de doble altura con vigas de ciprés rústico, estufa de leña de hierro fundido noruega y un jacuzzi privado exterior climatizado en el muelle de madera.',
    precio: 210,
    capacidad: 2,
    camas: 1,
    tipo: 'Suite',
    imagenes: [
      'https://images.unsplash.com/photo-1611891487122-2075b9624428?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1549294413-26f195afcbdb?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Hogar a Leña', 'Muelle Privado', 'Jacuzzi sobre el Lago', 'Cama King Patagónica', 'Cafetería de Especialidad Molida'],
    estado: 'disponible'
  },
  {
    id: 'room-302',
    hotelId: 'hotel-3',
    numero: 'B-2',
    nombre: 'Cabaña Familiar Wildwood',
    descripcion: 'Espacio optimizado para disfrutar de la naturaleza en familia. Dos dormitorios cerrados, amplio living con cocina integrada rústica totalmente equipada con vajilla hecha a mano por artesanos locales.',
    precio: 260,
    capacidad: 6,
    camas: 4,
    tipo: 'Suite',
    imagenes: [
      'https://images.unsplash.com/photo-1504643971488-5a2aa684be43?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&auto=format&fit=crop&q=80'
    ],
    servicios: ['Cocina Completa Rustica', 'Deck con Parrilla', '2 Dormitorios', 'Amplia Mesa de Comedor', 'Kayaks Incluidos'],
    estado: 'disponible'
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    nombre: 'Sofía',
    apellido: 'Altamirano',
    email: 'contacto@system.com',
    telefono: '+52 55 9988 7766',
    documento: 'PAS-9922883',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=facearea&facepad=2&q=80',
    rol: 'super_admin',
    fechaRegistro: '2025-10-10',
    estado: 'activo',
    password: '123456'
  },
  {
    id: 'user-hotel-admin-1',
    nombre: 'Mauricio',
    apellido: 'Larrañaga',
    email: 'mauricio@auramajestic.com',
    telefono: '+52 55 1234 5678',
    documento: 'INE-1002234',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=facearea&facepad=2&q=80',
    rol: 'hotel_admin',
    fechaRegistro: '2026-01-15',
    estado: 'activo',
    hotelId: 'hotel-1',
    password: '123456'
  },
  {
    id: 'user-recep-1',
    nombre: 'Elena',
    apellido: 'Gómez',
    email: 'elena@recep.com',
    telefono: '+52 55 4433 2211',
    documento: 'INE-5544321',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=facearea&facepad=2&q=80',
    rol: 'recepcionista',
    fechaRegistro: '2026-02-20',
    estado: 'activo',
    hotelId: 'hotel-1',
    password: '123456'
  },
  {
    id: 'user-recep-2',
    nombre: 'Carlos',
    apellido: 'Sanz',
    email: 'carlos@reception.com',
    telefono: '+34 600 112 233',
    documento: 'DNI-3847291Z',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=facearea&facepad=2&q=80',
    rol: 'recepcionista',
    fechaRegistro: '2026-03-01',
    estado: 'activo',
    hotelId: 'hotel-2',
    password: '123456'
  },
  {
    id: 'user-client',
    nombre: 'Gonzalo',
    apellido: 'Rodríguez',
    email: 'destructordereck@gmail.com', // Match the user's active session email for immersive experiences!
    telefono: '+54 11 9876 5432',
    documento: 'DNI-35492109',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=facearea&facepad=2&q=80',
    rol: 'cliente',
    fechaRegistro: '2026-04-10',
    estado: 'activo',
    password: '123456'
  }
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'RES-73829',
    hotelId: 'hotel-1',
    roomId: 'room-102',
    guestId: 'user-client',
    fechaEntrada: '2026-05-25',
    fechaSalida: '2026-05-28',
    serviciosAdicionales: ['Desayuno Premium', 'Acceso Spa Completo'],
    subtotal: 1440,
    impuestos: 230.4,
    total: 1670.4,
    qrCode: 'AURA-RES-73829-HOTEL-1-ROOM-102',
    estado: 'confirmada',
    fechaRegistro: '2026-05-20'
  },
  {
    id: 'RES-10492',
    hotelId: 'hotel-2',
    roomId: 'room-202',
    guestId: 'user-client',
    fechaEntrada: '2026-05-24',
    fechaSalida: '2026-05-26',
    serviciosAdicionales: ['Coworking Premium WiFi Pass'],
    subtotal: 260,
    impuestos: 41.6,
    total: 301.6,
    qrCode: 'AURA-RES-10492-HOTEL-2-ROOM-202',
    estado: 'confirmada',
    fechaRegistro: '2026-05-18'
  },
  {
    id: 'RES-88273',
    hotelId: 'hotel-1',
    roomId: 'room-101',
    guestId: 'user-client',
    fechaEntrada: '2026-05-10',
    fechaSalida: '2026-05-13',
    serviciosAdicionales: ['Traslado Aeropuerto', 'Masaje Relajante'],
    subtotal: 750,
    impuestos: 120,
    total: 870,
    qrCode: 'AURA-RES-88273-HOTEL-1-ROOM-101',
    estado: 'finalizada',
    fechaRegistro: '2026-05-02',
    checkedInAt: '2026-05-10T15:14:00Z',
    checkedOutAt: '2026-05-13T11:45:00Z',
    recepcionistaId: 'user-recep-1'
  },
  {
    id: 'RES-38294',
    hotelId: 'hotel-3',
    roomId: 'room-301',
    guestId: 'user-client',
    fechaEntrada: '2026-06-15',
    fechaSalida: '2026-06-20',
    serviciosAdicionales: ['Muelle Privado y Guía de Pesca'],
    subtotal: 1050,
    impuestos: 168,
    total: 1218,
    qrCode: 'AURA-RES-38294-HOTEL-3-ROOM-301',
    estado: 'pendiente',
    fechaRegistro: '2026-05-22'
  }
];
