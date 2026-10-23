// Empaqueta el backend (server/src/edge.ts) como Edge Function `chef` de Supabase, en un solo
// archivo con sus dependencias (zod, jose) y los alias @shared resueltos (decisión 0017).
// Uso: npm run supabase:funcion. El resultado no se versiona; se genera antes de desplegar.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const salida = join(raiz, 'supabase/functions/chef/index.ts')
mkdirSync(dirname(salida), { recursive: true })

const resultado = await build({
  entryPoints: [join(raiz, 'server/src/edge.ts')],
  tsconfig: join(raiz, 'tsconfig.server.json'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  // Deno usa las API web (fetch, crypto, Request); jose elige su versión WebCrypto.
  conditions: ['deno', 'worker', 'browser'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning'
})

const codigo = resultado.outputFiles[0].text
writeFileSync(
  salida,
  `// @ts-nocheck -- Generado por tools/empaquetar-funcion.mjs desde server/src/edge.ts. No editar.\n${codigo}`
)
const kb = (readFileSync(salida).length / 1024).toFixed(0)
console.info(`Edge Function generada en supabase/functions/chef/index.ts (${kb} KB)`)
