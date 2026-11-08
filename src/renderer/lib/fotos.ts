// Fotos de las recetas guardadas (tarea 18). Van dentro de la app, sin cargarse de internet. La
// semilla guarda la ruta («recetas/arroz_con_pollo.jpg») y aquí se convierte en la URL de Vite.

import creditos from '../assets/recetas/creditos.json'

const archivos = import.meta.glob<string>('../assets/recetas/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default'
})

export interface Foto {
  url: string
  /** Quién la hizo y dónde se publicó, para mostrarlo junto a la foto. */
  credito: string | null
  enlace: string | null
}

const porCredito = creditos as Record<string, { autor: string; fuente: string; url: string }>

/** `null` si la receta no tiene foto o el archivo no está en la app. */
export function fotoDe(imagen: string | null): Foto | null {
  if (!imagen) return null
  // Las recetas de la IA pueden traer una imagen creada por IA: se dice siempre que no es una foto.
  if (imagen.startsWith('data:image/'))
    return { url: imagen, credito: 'Imagen creada por IA, no es una foto real', enlace: null }
  const url = archivos[`../assets/${imagen}`]
  if (!url) return null
  const id = imagen.replace(/^recetas\//, '').replace(/\.jpg$/, '')
  const c = porCredito[id]
  return {
    url,
    credito: c ? `Foto: ${c.autor} · ${c.fuente}` : null,
    enlace: c?.url ?? null
  }
}
