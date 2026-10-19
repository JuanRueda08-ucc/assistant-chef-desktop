// Arranque local del backend: `npm run server:dev` (ver AGENTS.md, "Comandos").

import { crearApp } from './app'
import { AlmacenMemoria, Limitador, limitesDesdeEntorno } from './limite'
import { crearProveedor } from './proveedores'
import { iniciarServidor } from './servidor-node'

try {
  // Lee .env de la raíz si existe; las variables ya definidas en el entorno tienen prioridad.
  process.loadEnvFile()
} catch {
  // Sin .env: se usan los valores por defecto (proveedor falso, límites por defecto).
}

async function main(): Promise<void> {
  const proveedor = crearProveedor(process.env)
  const limites = limitesDesdeEntorno(process.env)
  const puerto = Number(process.env.SERVIDOR_PUERTO) || 8787

  const { url } = await iniciarServidor(
    crearApp({ proveedor, limitador: new Limitador(new AlmacenMemoria(), limites) }),
    puerto
  )
  console.info(`Backend del chef en ${url} (proveedor: ${proveedor.nombre})`, { limites })
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
