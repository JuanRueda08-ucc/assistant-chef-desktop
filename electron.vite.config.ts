import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { loadEnv } from 'vite'

const alias = { '@shared': resolve(__dirname, 'src/shared') }
// Solo valores públicos con prefijo CHEF_ (URL del backend y del proyecto de Supabase y su clave
// publicable). Nunca pongas un secreto con ese prefijo: acabaría dentro de la app.
const entornoChef = loadEnv('development', process.cwd(), 'CHEF_')

export default defineConfig({
  main: {
    define: {
      'import.meta.env.CHEF_API_URL': JSON.stringify(
        entornoChef.CHEF_API_URL ?? 'http://localhost:8787'
      ),
      'import.meta.env.CHEF_SUPABASE_URL': JSON.stringify(entornoChef.CHEF_SUPABASE_URL ?? ''),
      'import.meta.env.CHEF_SUPABASE_CLAVE_PUBLICA': JSON.stringify(
        entornoChef.CHEF_SUPABASE_CLAVE_PUBLICA ?? ''
      )
    },
    resolve: { alias }
  },
  preload: {
    resolve: { alias }
  },
  renderer: {
    build: { assetsInlineLimit: 0 },
    resolve: { alias },
    plugins: [svelte()]
  }
})
