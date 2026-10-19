import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANALES_IPC } from '@shared/types/ipc'
import { sesionNueva } from '@shared/cocina/fixtures.test-utils'
import { abrirBase } from './db/conexion'
import { guardarSesion } from './db/sesiones'
import { cargarSemilla, leerSemilla } from './db/semillas'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))
import { registrarIpc } from './ipc'

afterEach(() => handle.mockClear())

describe('voz:token IPC', () => {
  it('valida cuerpo vacío y no pide tokens fuera de cocinar', async () => {
    const db = abrirBase(':memory:')
    const pedirTokenVoz = vi.fn().mockResolvedValue({
      ok: true,
      credencial: { token: 'falso_test', expiraEn: new Date().toISOString() }
    })
    try {
      cargarSemilla(db, leerSemilla())
      registrarIpc(db, { pedirTokenVoz })
      const handler = handle.mock.calls.find(([canal]) => canal === CANALES_IPC.vozToken)![1] as (
        _evento: unknown,
        datos: unknown
      ) => Promise<unknown>
      await expect(handler(null, { url: 'http://atacante' })).rejects.toThrow()
      expect(await handler(null, {})).toMatchObject({
        ok: false,
        error: { codigo: 'fase_incorrecta' }
      })
      expect(pedirTokenVoz).not.toHaveBeenCalled()
      guardarSesion(db, sesionNueva())
      expect(await handler(null, {})).toMatchObject({ ok: true })
      expect(pedirTokenVoz).toHaveBeenCalledOnce()
    } finally {
      db.close()
    }
  })
})
