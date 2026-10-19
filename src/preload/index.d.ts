import type { ApiChef } from './api'

declare global {
  interface Window {
    api: ApiChef
  }
}
