import Database from 'better-sqlite3'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearCuentas, migrarCuentas } from '../../server/src/cuentas'
import type { Correo, TipoCodigo } from '../../server/src/correo'
import { iniciarServidor } from '../../server/src/servidor-node'
import { ORIGEN_APP } from '@shared/types/cuenta'
import { crearCuenta, type AlmacenSesion, type SesionGuardada } from './cuenta'

// El cliente de main contra Better Auth real en memoria, por HTTP local.
const codigos: { codigo: string; tipo: TipoCodigo }[] = []
const correo: Correo = {
  modo: 'consola',
  enviarCodigo: async (_destino, codigo, tipo) => {
    codigos.push({ codigo, tipo })
  }
}
const codigo = async (tipo: TipoCodigo): Promise<string> => {
  await new Promise((r) => setTimeout(r, 20))
  return codigos.filter((c) => c.tipo === tipo).at(-1)!.codigo
}
let apiUrl: URL
// Registra los Origin enviados: el fetch real de main añade sec-fetch-mode y Better Auth exige
// entonces un Origin de confianza; el fetch del entorno de tests no lo reproduce.
const origenes: (string | null)[] = []
const solicitar: typeof fetch = (url, init) => {
  origenes.push(new Headers(init?.headers).get('origin'))
  return fetch(url, init)
}
let servidor: Server

function almacen(): AlmacenSesion & { valor: SesionGuardada | null } {
  return {
    valor: null,
    leer() {
      return this.valor
    },
    guardar(s) {
      this.valor = s
    }
  }
}

// Servidor HTTP real y fetch real de Node, como en main: fetch añade sec-fetch-mode y Better Auth
// exige entonces un Origin de confianza (ORIGEN_APP).
beforeAll(async () => {
  const opciones = {
    db: new Database(':memory:'),
    secreto: 'secreto-de-prueba-con-mas-de-32-caracteres',
    url: 'http://127.0.0.1',
    correo
  }
  await migrarCuentas(opciones)
  const cuentas = crearCuentas(opciones)
  const iniciado = await iniciarServidor((peticion) => cuentas.manejar(peticion), 0)
  servidor = iniciado.servidor
  apiUrl = new URL(iniciado.url)
})
afterAll(() => {
  servidor.close()
})

describe('cuenta en main', () => {
  const datos = { nombre: 'Luis', email: 'luis@example.com', contrasena: 'sarten-2026' }

  it('registra, verifica con código, guarda la sesión y la recupera al reiniciar', async () => {
    const guardado = almacen()
    const cuenta = crearCuenta({ apiUrl, almacen: guardado, solicitar })
    expect(await cuenta.iniciar()).toEqual({ usuario: null, sinConexion: false })

    expect((await cuenta.registrar(datos)).ok).toBe(true)
    expect(cuenta.estado().usuario).toBeNull()
    const entrarAntes = await cuenta.entrar(datos)
    expect(entrarAntes.ok || entrarAntes.error.codigo).toBe('correo_sin_verificar')

    const mal = await cuenta.verificar({ email: datos.email, codigo: '000000' })
    expect(mal.ok || mal.error.codigo).toBe('codigo_invalido')
    const verificado = await cuenta.verificar({
      email: datos.email,
      codigo: await codigo('email-verification')
    })
    expect(verificado.ok && verificado.estado.usuario).toMatchObject({
      nombre: 'Luis',
      email: datos.email
    })
    expect(guardado.valor?.token).toBeTruthy()

    // Otro arranque con el mismo almacén: sigue dentro sin pedir la contraseña.
    const otra = crearCuenta({ apiUrl, almacen: guardado, solicitar })
    expect((await otra.iniciar()).usuario?.email).toBe(datos.email)
  })

  it('no revela si un correo ya tiene cuenta, rechaza credenciales y salir invalida el token', async () => {
    const guardado = almacen()
    const cuenta = crearCuenta({ apiUrl, almacen: guardado, solicitar })
    // Con verificación obligatoria, Better Auth responde igual a un registro repetido.
    expect((await cuenta.registrar(datos)).ok).toBe(true)
    expect(cuenta.estado().usuario).toBeNull()
    const mal = await cuenta.entrar({ email: datos.email, contrasena: 'otra-clave-1' })
    expect(mal.ok || mal.error.codigo).toBe('credenciales')

    expect((await cuenta.entrar(datos)).ok).toBe(true)
    const token = cuenta.token()
    await cuenta.salir()
    expect(cuenta.estado().usuario).toBeNull()
    expect(guardado.valor).toBeNull()
    // El token cerrado ya no sirve en otro arranque.
    guardado.valor = { token: token!, usuario: { id: 'x', nombre: 'Luis', email: datos.email } }
    expect((await crearCuenta({ apiUrl, almacen: guardado, solicitar }).iniciar()).usuario).toBe(
      null
    )
  })

  it('todas las peticiones llevan el origen de la app', () => {
    expect(origenes.length).toBeGreaterThan(0)
    expect(new Set(origenes)).toEqual(new Set([ORIGEN_APP]))
  })

  it('recupera la contraseña con código', async () => {
    const cuenta = crearCuenta({ apiUrl, almacen: almacen(), solicitar })
    expect((await cuenta.recuperar(datos.email)).ok).toBe(true)
    const r = await cuenta.restablecer({
      email: datos.email,
      codigo: await codigo('forget-password'),
      contrasena: 'nueva-sarten-1'
    })
    expect(r.ok).toBe(true)
    expect((await cuenta.entrar({ email: datos.email, contrasena: 'nueva-sarten-1' })).ok).toBe(
      true
    )
  })

  it('sin red conserva la sesión guardada y lo indica', async () => {
    const guardado = almacen()
    guardado.valor = { token: 't', usuario: { id: 'u1', nombre: 'Luis', email: datos.email } }
    const cuenta = crearCuenta({
      apiUrl,
      almacen: guardado,
      solicitar: async () => {
        throw new TypeError('fetch failed')
      }
    })
    expect(await cuenta.iniciar()).toEqual({
      usuario: guardado.valor.usuario,
      sinConexion: true
    })
    const r = await cuenta.entrar(datos)
    expect(r.ok || r.error.codigo).toBe('sin_conexion')
  })
})
