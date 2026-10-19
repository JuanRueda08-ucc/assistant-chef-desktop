import type { ApiChef } from '@shared/types/ipc'

declare global {
  interface Window {
    api: ApiChef
  }
}
