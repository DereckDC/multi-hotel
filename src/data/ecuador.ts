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
