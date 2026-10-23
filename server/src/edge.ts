// Entrada del backend como Edge Function de Supabase (decisión 0017). `npm run supabase:funcion`
// la empaqueta con sus dependencias en supabase/functions/chef/index.ts y se despliega con
// `npx supabase functions deploy chef --no-verify-jwt` (la verificación del JWT la hace app.ts).

import type { JSONWebKeySet } from 'jose'
import { AlmacenSupabase, claveSecretaDesdeEntorno } from './almacen-supabase'
import { crearApp } from './app'
import { crearCuentas } from './cuentas'
import { Limitador, limitesDesdeEntorno } from './limite'
import { crearProveedor } from './proveedores'
import { rutaSinFuncion } from './ruta-funcion'

// Deno, el entorno de las Edge Functions; solo se declara lo que se usa.
declare const Deno: {
  env: { toObject(): Record<string, string> }
  serve(manejar: (peticion: Request) => Promise<Response>): unknown
}

const env = Deno.env.toObject()
const supabaseUrl = env.SUPABASE_URL ?? ''
let jwks: JSONWebKeySet | undefined
try {
  jwks = env.SUPABASE_JWKS ? (JSON.parse(env.SUPABASE_JWKS) as JSONWebKeySet) : undefined
} catch {
  jwks = undefined
}

const manejar = crearApp({
  proveedor: crearProveedor(env),
  limitador: new Limitador(
    new AlmacenSupabase(supabaseUrl, claveSecretaDesdeEntorno(env)),
    limitesDesdeEntorno(env)
  ),
  cuentas: crearCuentas({ supabaseUrl, jwks })
})

Deno.serve((peticion) => manejar(new Request(rutaSinFuncion(peticion.url), peticion)))
