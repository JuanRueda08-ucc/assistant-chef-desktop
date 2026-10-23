import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { abrirBase, type BaseDatos } from './db/conexion'
import { cargarSemilla, leerSemilla } from './db/semillas'
import { registrarIpc } from './ipc'
import { obtenerIdInstalacion } from './instalacion'
import { crearClienteBackend, validarApiUrl } from './backend'
import { crearAlmacenSesion } from './almacen-sesion'
import { crearCuenta, type Cuenta } from './cuenta'
import { crearVozLocal } from './voz/local'
import { crearLectorLocal } from './voz/lector'
import { obtenerSesionCocinando } from './db/sesiones'

let db: BaseDatos | null = null
const lector = crearLectorLocal()
let voz: ReturnType<typeof crearVozLocal> | null = null
let cuenta: Cuenta | null = null

/** El micrófono solo se concede con una cuenta dentro y una receta cocinándose. */
function hayCocinaActiva(): boolean {
  const usuario = cuenta?.estado().usuario
  return db !== null && !!usuario && obtenerSesionCocinando(db, usuario.id) !== null
}

function crearVentana(): void {
  const ventana = new BrowserWindow({
    width: 1200,
    height: 800,
    // Por debajo de este tamaño las pantallas dejan de caber (docs/diseno.md).
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'Chef digital',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Seguridad de Electron (ver AGENTS.md): el renderer no ve Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  ventana.on('ready-to-show', () => {
    ventana.show()
  })
  // Solo audio de esta ventana, mientras hay una cocina activa; cámara siempre denegada.
  ventana.webContents.session.setPermissionRequestHandler(
    (contenido, permiso, responder, detalles) => {
      responder(
        contenido === ventana.webContents &&
          permiso === 'media' &&
          detalles.isMainFrame &&
          'mediaTypes' in detalles &&
          detalles.mediaTypes?.length === 1 &&
          detalles.mediaTypes[0] === 'audio' &&
          hayCocinaActiva()
      )
    }
  )
  ventana.webContents.session.setPermissionCheckHandler(
    (contenido, permiso, _origen, detalles) =>
      contenido === ventana.webContents &&
      permiso === 'media' &&
      detalles.mediaType === 'audio' &&
      hayCocinaActiva()
  )
  ventana.webContents.on('render-process-gone', () => {
    voz?.detener()
    lector.detener()
  })
  ventana.webContents.on('did-start-navigation', (_evento, _url, _inPlace, mainFrame) => {
    if (mainFrame) {
      voz?.detener()
      lector.detener()
    }
  })

  // Los enlaces externos se abren en el navegador del sistema, nunca dentro de la app.
  ventana.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // En desarrollo carga el servidor de electron-vite (HMR); en producción, el HTML empaquetado.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    ventana.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    ventana.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.chefdigital.app')

  // F12 abre DevTools en desarrollo; en producción se ignora Ctrl/Cmd+R.
  app.on('browser-window-created', (_, ventana) => {
    optimizer.watchWindowShortcuts(ventana)
  })

  try {
    // La base vive en la carpeta de datos del usuario; se crea y se siembra en cada arranque.
    db = abrirBase(join(app.getPath('userData'), 'chef.sqlite'))
    cargarSemilla(db, leerSemilla())
    const instalacion = obtenerIdInstalacion(app.getPath('userData'))
    const apiUrl =
      process.env.CHEF_API_URL ?? import.meta.env.CHEF_API_URL ?? 'http://localhost:8787'
    // Proyecto de Supabase para las cuentas (0017): URL y clave publicable, públicas por diseño.
    const supabaseUrl = process.env.CHEF_SUPABASE_URL ?? import.meta.env.CHEF_SUPABASE_URL
    const clavePublica =
      process.env.CHEF_SUPABASE_CLAVE_PUBLICA ?? import.meta.env.CHEF_SUPABASE_CLAVE_PUBLICA
    if (!supabaseUrl || !clavePublica)
      throw new Error(
        'Faltan CHEF_SUPABASE_URL y CHEF_SUPABASE_CLAVE_PUBLICA en .env (ver docs/despliegue.md).'
      )
    const sesionCuenta = crearCuenta({
      supabaseUrl: validarApiUrl(supabaseUrl),
      clavePublica,
      almacen: crearAlmacenSesion(app.getPath('userData'))
    })
    cuenta = sesionCuenta
    const backend = crearClienteBackend(apiUrl, instalacion, fetch, Date.now, {
      token: sesionCuenta.token,
      caducada: sesionCuenta.caducada
    })
    voz = crearVozLocal(
      app.isPackaged ? join(process.resourcesPath, 'voz') : join(app.getAppPath(), 'resources/voz')
    )
    registrarIpc(db, backend, voz, lector, sesionCuenta)
  } catch (error) {
    dialog.showErrorBox(
      'No se pudo preparar la app',
      error instanceof Error ? error.message : String(error)
    )
    app.quit()
    return
  }

  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('will-quit', () => {
  voz?.detener()
  lector.detener()
  db?.close()
  db = null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
