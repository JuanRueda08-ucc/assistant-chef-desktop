// Aviso sonoro de un temporizador: tres pitidos generados en el momento, sin archivos ni IA.

let contexto: AudioContext | null = null

export function sonarAviso(): void {
  try {
    contexto ??= new AudioContext()
    const inicio = contexto.currentTime + 0.05
    for (let i = 0; i < 3; i++) {
      const tono = contexto.createOscillator()
      const volumen = contexto.createGain()
      tono.type = 'sine'
      tono.frequency.value = i === 2 ? 1175 : 880
      const t = inicio + i * 0.28
      volumen.gain.setValueAtTime(0, t)
      volumen.gain.linearRampToValueAtTime(0.25, t + 0.02)
      volumen.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
      tono.connect(volumen).connect(contexto.destination)
      tono.start(t)
      tono.stop(t + 0.25)
    }
  } catch {
    /* Sin audio disponible: queda el aviso en pantalla. */
  }
}
