import { contextBridge, ipcRenderer } from 'electron'
import { CANALES_IPC, type ApiChef } from '@shared/types/ipc'

// API mínima y tipada que ve el renderer. No se expone `ipcRenderer` en bruto: cada canal tiene
// su función. El contrato vive en src/shared/types/ipc.ts y main lo implementa en src/main/ipc.ts.
const api: ApiChef = {
  recetas: {
    listar: () => ipcRenderer.invoke(CANALES_IPC.recetasListar),
    obtener: (id) => ipcRenderer.invoke(CANALES_IPC.recetasObtener, id)
  }
}

contextBridge.exposeInMainWorld('api', api)
