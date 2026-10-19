// Nombres para mostrar de las listas cerradas del dominio. Un `Record` por lista obliga a dar
// nombre a cada valor nuevo (si falta uno, `npm run typecheck` falla).

import type { Alergeno, CategoriaIngrediente, Dieta, Dificultad, Equipo } from './types/receta'

export const NOMBRE_DIETA: Record<Dieta, string> = {
  vegetariana: 'Vegetariana',
  vegana: 'Vegana',
  sin_gluten: 'Sin gluten',
  sin_lactosa: 'Sin lactosa'
}

export const NOMBRE_ALERGENO: Record<Alergeno, string> = {
  gluten: 'Gluten',
  crustaceos: 'Crustáceos',
  huevo: 'Huevo',
  pescado: 'Pescado',
  cacahuete: 'Cacahuete',
  soja: 'Soja',
  lacteos: 'Lácteos',
  frutos_secos: 'Frutos secos',
  apio: 'Apio',
  mostaza: 'Mostaza',
  sesamo: 'Sésamo',
  sulfitos: 'Sulfitos',
  altramuces: 'Altramuces',
  moluscos: 'Moluscos'
}

export const NOMBRE_EQUIPO: Record<Equipo, string> = {
  horno: 'Horno',
  sarten: 'Sartén',
  olla: 'Olla',
  olla_presion: 'Olla a presión',
  licuadora: 'Licuadora',
  batidora: 'Batidora',
  microondas: 'Microondas',
  freidora_aire: 'Freidora de aire',
  plancha: 'Plancha'
}

export const NOMBRE_CATEGORIA: Record<CategoriaIngrediente, string> = {
  verduras: 'Verduras',
  frutas: 'Frutas',
  proteinas: 'Proteínas',
  lacteos: 'Lácteos',
  cereales: 'Cereales',
  legumbres: 'Legumbres',
  especias: 'Especias',
  despensa: 'Despensa'
}

export const NOMBRE_DIFICULTAD: Record<Dificultad, string> = {
  facil: 'Fácil',
  media: 'Media',
  avanzada: 'Avanzada'
}
