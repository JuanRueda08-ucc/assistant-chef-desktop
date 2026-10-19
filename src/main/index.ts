import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { abrirBase, type BaseDatos } from './db/conexion'
import { cargarSemilla, leerSemilla } from './db/semillas'
import { registrarIpc } from './ipc'

let db: BaseDatos | null = null

function crearVentana(): void {
  const ventana = new BrowserWindow({
    width: 1200,
    height: 800,
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
  } catch (error) {
    dialog.showErrorBox(
      'No se pudo preparar la base de datos',
      error instanceof Error ? error.message : String(error)
    )
    app.quit()
    return
  }
  registrarIpc(db)

  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('will-quit', () => {
  db?.close()
  db = null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
