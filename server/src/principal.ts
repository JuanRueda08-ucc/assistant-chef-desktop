// Arranque local del backend: `npm run server:dev` (ver AGENTS.md, "Comandos").

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { crearApp } from './app'
import { correoDesdeEntorno } from './correo'
import { crearCuentas, migrarCuentas } from './cuentas'
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

  const secreto = process.env.BETTER_AUTH_SECRET ?? ''
  if (secreto.length < 32)
    throw new Error(
      'Falta BETTER_AUTH_SECRET (al menos 32 caracteres) en .env. Genera uno con: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"'
    )
  const rutaCuentas = resolve(process.env.CUENTAS_DB ?? '.datos/cuentas.sqlite')
  mkdirSync(dirname(rutaCuentas), { recursive: true })
  const db = new Database(rutaCuentas)
  db.pragma('journal_mode = WAL')
  const correo = correoDesdeEntorno(process.env)
  const opcionesCuentas = {
    db,
    secreto,
    url: process.env.BETTER_AUTH_URL ?? `http://localhost:${puerto}`,
    correo
  }
  await migrarCuentas(opcionesCuentas)

  const { url } = await iniciarServidor(
    crearApp({
      proveedor,
      limitador: new Limitador(new AlmacenMemoria(), limites),
      cuentas: crearCuentas(opcionesCuentas)
    }),
    puerto
  )
  console.info(`Backend del chef en ${url} (proveedor: ${proveedor.nombre})`, {
    limites,
    correo: correo.modo
  })
  if (correo.modo === 'consola')
    console.info('Sin SMTP: los códigos de las cuentas se muestran en esta consola.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
