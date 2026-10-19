import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

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

  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
