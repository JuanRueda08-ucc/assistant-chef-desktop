import { contextBridge } from 'electron'
import type { ApiChef } from './api'

// API mínima y tipada que ve el renderer. Los canales IPC se añaden aquí (tarea 2 del roadmap).
const api: ApiChef = {}

contextBridge.exposeInMainWorld('api', api)
