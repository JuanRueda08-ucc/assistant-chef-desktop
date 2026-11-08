// Lo que dice el chef al entrar a Inicio: cambia cada vez, según la hora y al azar (pedido del autor).

const GENERALES = [
  '¡Qué bueno verte!',
  '¿Qué se te antoja hoy?',
  '¡A cocinar se ha dicho!',
  'Hoy huele a algo rico.',
  '¡Manos a la olla!',
  'Tengo ganas de cocinar contigo.',
  '¿Probamos algo nuevo?'
]

function porHora(hora: number): string {
  if (hora < 12) return '¡Buenos días!'
  if (hora < 19) return '¡Buenas tardes!'
  return '¡Buenas noches!'
}

/** Un saludo para esta visita. `azar` entre 0 y 1; la mitad de las veces saluda según la hora. */
export function saludoDelChef(hora: number, azar: number, nombre: string | null = null): string {
  const base =
    azar < 0.5
      ? porHora(hora)
      : GENERALES[Math.floor(azar * 2 * GENERALES.length) % GENERALES.length]!
  return nombre && azar < 0.5 ? base.replace('!', `, ${nombre}!`) : base
}
