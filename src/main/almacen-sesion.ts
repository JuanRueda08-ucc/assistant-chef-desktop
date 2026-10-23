// Sesión de la cuenta entre arranques (decisiones 0016 y 0017): archivo en userData cifrado con
// safeStorage. Si el sistema no ofrece cifrado (algunos Linux usan un almacén en claro), no se
// guarda nada y hay que entrar en cada arranque.

import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { esquemaSesionGuardada, type AlmacenSesion } from './cuenta'

export function crearAlmacenSesion(carpeta: string): AlmacenSesion {
  const ruta = join(carpeta, 'cuenta.bin')
  const cifrado = (): boolean =>
    safeStorage.isEncryptionAvailable() &&
    !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
  return {
    leer() {
      if (!cifrado()) return null
      try {
        const datos = esquemaSesionGuardada.safeParse(
          JSON.parse(safeStorage.decryptString(readFileSync(ruta)))
        )
        return datos.success ? datos.data : null
      } catch {
        return null
      }
    },
    guardar(sesion) {
      if (!sesion || !cifrado()) {
        rmSync(ruta, { force: true })
        return
      }
      writeFileSync(ruta, safeStorage.encryptString(JSON.stringify(sesion)), { mode: 0o600 })
    }
  }
}
