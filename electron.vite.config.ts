import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { loadEnv } from 'vite'

const alias = { '@shared': resolve(__dirname, 'src/shared') }
// Solo la URL pública; ninguna variable de proveedor se incorpora al bundle.
const entornoChef = loadEnv('development', process.cwd(), 'CHEF_API_URL')

export default defineConfig({
  main: {
    define: {
      'import.meta.env.CHEF_API_URL': JSON.stringify(
        entornoChef.CHEF_API_URL ?? 'http://localhost:8787'
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
