import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') }
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    // Todavía no hay lógica en src/shared; los tests llegan con las tareas 3 a 9 del roadmap.
    passWithNoTests: true
  }
})
