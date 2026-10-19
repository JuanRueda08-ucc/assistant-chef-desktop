/** PCM signed 16-bit little endian, mono. AudioContext hace el remuestreo a 16 kHz. */
export function aPcm16(muestras: Float32Array): ArrayBuffer {
  const salida = new ArrayBuffer(muestras.length * 2)
  const vista = new DataView(salida)
  muestras.forEach((m, i) => {
    const valor = Math.max(-1, Math.min(1, m))
    vista.setInt16(i * 2, Math.round(valor * (valor < 0 ? 32768 : 32767)), true)
  })
  return salida
}

export function aBase64(audio: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(audio)))
}

export function amplitud(audio: ArrayBuffer): number {
  const vista = new DataView(audio)
  let suma = 0
  for (let i = 0; i < audio.byteLength; i += 2) suma += (vista.getInt16(i, true) / 32768) ** 2
  return Math.sqrt(suma / (audio.byteLength / 2))
}
