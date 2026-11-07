/** Permiso del botón «Hablar» del chat (0020): abre el micrófono fuera de Cocinar mientras dura. */
export const dictado = { activo: false }

/** Si la ventana no llega a cerrarlo, el permiso caduca: la frase dura ocho segundos como mucho. */
export const MS_MAX_DICTADO = 15_000
