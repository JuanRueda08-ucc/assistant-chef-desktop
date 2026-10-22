import { contextBridge, ipcRenderer } from 'electron'
import { CANALES_IPC, type ApiChef } from '@shared/types/ipc'

// API mínima y tipada que ve el renderer. No se expone `ipcRenderer` en bruto: cada canal tiene
// su función. El contrato vive en src/shared/types/ipc.ts y main lo implementa en src/main/ipc.ts.
const api: ApiChef = {
  cuenta: {
    estado: () => ipcRenderer.invoke(CANALES_IPC.cuentaEstado),
    registrar: (datos) => ipcRenderer.invoke(CANALES_IPC.cuentaRegistrar, datos),
    verificar: (datos) => ipcRenderer.invoke(CANALES_IPC.cuentaVerificar, datos),
    reenviar: (datos) => ipcRenderer.invoke(CANALES_IPC.cuentaReenviar, datos),
    entrar: (datos) => ipcRenderer.invoke(CANALES_IPC.cuentaEntrar, datos),
    salir: () => ipcRenderer.invoke(CANALES_IPC.cuentaSalir),
    recuperar: (datos) => ipcRenderer.invoke(CANALES_IPC.cuentaRecuperar, datos),
    restablecer: (datos) => ipcRenderer.invoke(CANALES_IPC.cuentaRestablecer, datos)
  },
  chef: { conversar: (datos) => ipcRenderer.invoke(CANALES_IPC.chefConversar, datos) },
  voz: {
    token: (datos) => ipcRenderer.invoke(CANALES_IPC.vozToken, datos),
    iniciar: (datos) => ipcRenderer.invoke(CANALES_IPC.vozIniciar, datos),
    reconocer: (audio) => ipcRenderer.invoke(CANALES_IPC.vozReconocer, audio),
    reset: (datos) => ipcRenderer.invoke(CANALES_IPC.vozReset, datos),
    detener: (datos) => ipcRenderer.invoke(CANALES_IPC.vozDetener, datos),
    repetir: (datos) => ipcRenderer.invoke(CANALES_IPC.vozRepetir, datos),
    narrar: (datos) => ipcRenderer.invoke(CANALES_IPC.vozNarrar, datos),
    callar: (datos) => ipcRenderer.invoke(CANALES_IPC.vozCallar, datos)
  },
  catalogo: {
    ingredientes: () => ipcRenderer.invoke(CANALES_IPC.catalogoIngredientes)
  },
  recetas: {
    listar: () => ipcRenderer.invoke(CANALES_IPC.recetasListar),
    obtener: (id) => ipcRenderer.invoke(CANALES_IPC.recetasObtener, id),
    buscar: (preferencias) => ipcRenderer.invoke(CANALES_IPC.recetasBuscar, preferencias)
  },
  sesion: {
    retomar: () => ipcRenderer.invoke(CANALES_IPC.sesionRetomar),
    iniciar: (datos) => ipcRenderer.invoke(CANALES_IPC.sesionIniciar, datos),
    aplicar: (llamada) => ipcRenderer.invoke(CANALES_IPC.sesionAplicar, llamada)
  }
}

contextBridge.exposeInMainWorld('api', api)
