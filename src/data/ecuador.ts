/**
 * Data de Provincias y Ciudades/Cantones del Ecuador
 */

export interface ProvinceData {
  provincia: string;
  ciudades: string[];
}

export const ECUADOR_PROVINCES: ProvinceData[] = [
  { provincia: "Azuay", ciudades: ["Cuenca", "Gualaceo", "Paute", "Sigsig", "Santa Isabel", "Camilo Ponce Enríquez", "Chordeleg", "Girón", "San Fernando", "Sevilla de Oro"] },
  { provincia: "Bolívar", ciudades: ["Guaranda", "San Miguel", "Chimbo", "Echeandía", "Caluma", "Las Naves", "Chillanes"] },
  { provincia: "Cañar", ciudades: ["Azogues", "La Troncal", "Cañar", "Biblián", "El Tambo", "Déleg", "Suscal"] },
  { provincia: "Carchi", ciudades: ["Tulcán", "Bolívar", "Espejo", "Mira", "Montúfar", "San Pedro de Huaca"] },
  { provincia: "Chimborazo", ciudades: ["Riobamba", "Alausí", "Guano", "Chambo", "Colta", "Cumandá", "Guamote", "Pallatanga", "Penipe"] },
  { provincia: "Cotopaxi", ciudades: ["Latacunga", "Salcedo", "Pujilí", "La Maná", "Saquisilí", "Sigchos", "Pangua"] },
  { provincia: "El Oro", ciudades: ["Machala", "Pasaje", "Santa Rosa", "Arenillas", "Huaquillas", "Piñas", "Zaruma", "Atahualpa", "El Guabo", "Portovelo", "Chilla"] },
  { provincia: "Esmeraldas", ciudades: ["Esmeraldas", "Atacames", "Quinindé", "San Lorenzo", "Muisne", "Rioverde", "Eloy Alfaro"] },
  { provincia: "Galápagos", ciudades: ["Puerto Ayora (Santa Cruz)", "Puerto Baquerizo Moreno (San Cristóbal)", "Puerto Villamil (Isabela)"] },
  { provincia: "Guayas", ciudades: ["Guayaquil", "Samborondón", "Daule", "Durán", "Milagro", "El Empalme", "Balzar", "Playas (General Villamil)", "Pedro Carbo", "Naranjal", "Yaguachi", "Salitre", "Santa Lucía"] },
  { provincia: "Imbabura", ciudades: ["Ibarra", "Otavalo", "Cotacachi", "Antonio Ante (Atuntaqui)", "Urcuquí", "Pimampiro"] },
  { provincia: "Loja", ciudades: ["Loja", "Catamayo", "Vilcabamba", "Cariamanga", "Saraguro", "Macará", "Alamor", "Celica", "Paltas", "Espíndola", "Puyango", "Zapotillo"] },
  { provincia: "Los Ríos", ciudades: ["Babahoyo", "Quevedo", "Vinces", "Buena Fe", "Ventanas", "Mocache", "Valencia", "Palenque", "Baba", "Puebloviejo", "Urdaneta"] },
  { provincia: "Manabí", ciudades: ["Manta", "Portoviejo", "Chone", "Montecristi", "Bahía de Caráquez", "Jipijapa", "Pedernales", "Puerto López", "Rocafuerte", "Calceta", "Sucre", "Tosagua", "Flavio Alfaro", "San Vicente"] },
  { provincia: "Morona Santiago", ciudades: ["Macas", "Gualaquiza", "Sucúa", "Méndez", "Palora", "Limón Indanza", "Taisha", "Tiwinza"] },
  { provincia: "Napo", ciudades: ["Tena", "Archidona", "El Chaco", "Baeza", "Quijos", "Carlos Julio Arosemena Tola"] },
  { provincia: "Orellana", ciudades: ["Puerto Francisco de Orellana (El Coca)", "Loreto", "Joya de los Sachas", "Aguarico"] },
  { provincia: "Pastaza", ciudades: ["Puyo", "Mera", "Santa Clara", "Arajuno"] },
  { provincia: "Pichincha", ciudades: ["Quito", "Rumiñahui (Sangolquí)", "Cayambe", "Mejía (Machachi)", "Puerto Quito", "Pedro Moncayo (Tabacundo)", "San Miguel de los Bancos", "Pedro Vicente Maldonado"] },
  { provincia: "Santa Elena", ciudades: ["Santa Elena", "Salinas", "La Libertad", "Montañita", "Olón", "Ayangue"] },
  { provincia: "Santo Domingo de los Tsáchilas", ciudades: ["Santo Domingo", "La Concordia"] },
  { provincia: "Sucumbíos", ciudades: ["Nueva Loja (Lago Agrio)", "Shushufindi", "Cascales", "Cuyabeno", "Gonzalo Pizarro", "Putumayo", "Sucumbíos"] },
  { provincia: "Tungurahua", ciudades: ["Ambato", "Baños de Agua Santa", "Pelileo", "Píllaro", "Cevallos", "Mocha", "Patate", "Quero", "Tisaleo"] },
  { provincia: "Zamora Chinchipe", ciudades: ["Zamora", "Yantzaza", "El Pangui", "Centinela del Cóndor", "Palanda", "Zumba", "Nangaritza"] }
];

export function getProvincesList(): string[] {
  return ECUADOR_PROVINCES.map(p => p.provincia);
}

export function getCitiesForProvince(provinciaName: string): string[] {
  if (!provinciaName) return [];
  const found = ECUADOR_PROVINCES.find(p => p.provincia.toLowerCase() === provinciaName.toLowerCase());
  return found ? found.ciudades : [];
}

/**
 * Parroquias destacadas por Cantón / Ciudad en Ecuador
 */
export const ECUADOR_PARROQUIAS: Record<string, string[]> = {
  "Quito": [
    "Iñaquito", "Mariscal Sucre", "Centro Histórico", "Cumbayá", "Tumbaco", "Calderón",
    "Pomasqui", "San Antonio de Pichincha", "Conocoto", "Puembo", "Guamani", "Cotocollao",
    "Carcelén", "Quitumbe", "La Magdalena", "Chimbacalle", "Pifo", "Nayón", "Tababela"
  ],
  "Guayaquil": [
    "Tarqui", "Ximena", "Febres Cordero", "Letamendi", "Garcia Moreno", "Urdaneta",
    "Chongón", "Pascuales", "Posorja", "Puná", "Tenguel", "Progreso", "Puerto Bolívar", "Samanes", "Urdesa", "Ceibos"
  ],
  "Cuenca": [
    "El Sagrario", "San Sebastián", "Huayna Cápac", "Bellavista", "Yanuncay", "Sucre",
    "Baños", "Ricaurte", "San Joaquín", "Sayausí", "Turi", "Valle", "Molleturo", "Chaucha"
  ],
  "Manta": [
    "Manta (Urbana)", "Tarqui", "Los Esteros", "San Mateo", "Eloy Alfaro", "San Lorenzo", "Santa Marianita"
  ],
  "Portoviejo": [
    "Portoviejo Centro", "12 de Marzo", "18 de Octubre", "Andrés de Vera", "Crucita", "Picoazá", "Calderón", "Riochico"
  ],
  "Ambato": [
    "Atocha-Ficoa", "Huachi Chico", "Huachi Loreto", "La Merced", "Matriz", "Izamba", "Atahualpa", "Santa Rosa", "Quisapincha"
  ],
  "Riobamba": [
    "Lizarzaburu", "Maldonado", "Velasco", "Veloz", "Yaruquíes", "Licán", "San Luis", "Calpi", "Químiag"
  ],
  "Loja": [
    "El Sagrario", "Sucre", "San Sebastián", "Valle", "Vilcabamba", "Malacatos", "El Cisne", "Yangana", "San Lucas"
  ],
  "Salinas": [
    "Salinas (Urbana)", "General Alberto Enríquez Gallo", "Carlos Espinoza Larrea", "Vicente Rocafuerte", "Anconcito", "José Luis Tamayo (Muey)"
  ],
  "Santa Elena": [
    "Santa Elena", "Ballenita", "Colonche", "Chanduy", "Manglaralto", "Olón", "Montañita", "Ayangue"
  ],
  "Ibarra": [
    "Sagrario", "San Francisco", "Caranqui", "Alpachaca", "Priorato", "San Antonio de Ibarra", "Ambuquí", "La Esperanza"
  ],
  "Santo Domingo": [
    "Abraham Calazacón", "Chiguilpe", "Río Verde", "Bombolí", "Zaracay", "Alluriquín", "Puerto Limón", "Valle Hermoso"
  ],
  "Esmeraldas": [
    "Bartolomé Ruiz", "5 de Agosto", "Esmeraldas", "Luis Tello", "Simón Plata Torres", "Atacames", "Tachina", "Vuelta Larga"
  ],
  "Machala": [
    "Machala Centro", "Puerto Bolívar", "La Providencia", "9 de Mayo", "El Cambio", "El Retiro"
  ],
  "Quevedo": [
    "Quevedo Centro", "24 de Mayo", "Guayacán", "San Camilo", "San Cristóbal", "Seven de Octubre", "Venus del Río Quevedo", "La Esperanza"
  ],
  "Latacunga": [
    "La Matriz", "Eloy Alfaro", "Ignacio Flores", "Juan Montalvo", "San Buenaventura", "Belisario Quevedo", "Guaytacama", "Mulaló", "Pastocalle", "Tanicuchí"
  ],
  "Baños de Agua Santa": [
    "Baños Centro", "Lligua", "Río Verde", "Río Negro", "Ulba"
  ],
  "Samborondón": [
    "Samborondón Cabecera", "La Puntilla", "Tarifa"
  ],
  "Daule": [
    "Daule Cabecera", "La Aurora", "Banife", "Juan Bautista Aguirre", "Laurel", "Los Lojas"
  ],
  "Durán": [
    "Eloy Alfaro", "El Recreo", "Abel Gilbert", "Divino Niño", "Panorama"
  ],
  "Otavalo": [
    "Jordán", "San Luis", "Eugenio Espejo", "González Suárez", "San José de Quichinche", "San Juan de Ilumán", "San Pablo"
  ],
  "Cayambe": [
    "Cayambe Centro", "Ayora", "Ascázubi", "Cangahua", "Olmedo", "Santa Rosa de Cuzubamba"
  ],
  "Rumiñahui (Sangolquí)": [
    "Sangolquí Centro", "San Pedro de Taboada", "San Rafael", "Cotogchoa", "Rumipamba"
  ],
  "Atacames": [
    "Atacames Centro", "Tonsupa", "Súa", "Same", "Tonchigue"
  ],
  "Montañita": [
    "Montañita Centro", "Manglaralto", "Olón", "Ayangue"
  ],
  "Puerto Ayora (Santa Cruz)": [
    "Puerto Ayora Centro", "Bellavista", "Santa Rosa"
  ],
  "Puerto Baquerizo Moreno (San Cristóbal)": [
    "Puerto Baquerizo Centro", "El Progreso", "Isla Santa María"
  ]
};

export function getParroquiasForCity(provinciaName: string, cityName: string): string[] {
  if (!cityName) return [];
  // Clean city name (e.g. remove parentheses like "Puerto Ayora (Santa Cruz)")
  const cleanCity = cityName.split('(')[0].trim();
  
  // Search exact match or clean match in dictionary
  for (const [key, val] of Object.entries(ECUADOR_PARROQUIAS)) {
    if (key.toLowerCase() === cityName.toLowerCase() || key.toLowerCase().includes(cleanCity.toLowerCase())) {
      return val;
    }
  }

  // Generic fallback parroquias for any other city in Ecuador
  return [
    `${cleanCity} Centro (Urbana)`,
    "Norte",
    "Sur",
    "Este",
    "Oeste",
    "Cabecera Cantonal",
    "Zona Rural / Periferia"
  ];
}

