/** PCM16 mono a 16 kHz dentro de un WAV en memoria, en base64. El audio nunca se escribe a disco. */
export function pcmAWavBase64(pcm: ArrayBuffer): string {
  const cabecera = Buffer.alloc(44)
  cabecera.write('RIFF', 0, 'ascii')
  cabecera.writeUInt32LE(36 + pcm.byteLength, 4)
  cabecera.write('WAVEfmt ', 8, 'ascii')
  cabecera.writeUInt32LE(16, 16)
  cabecera.writeUInt16LE(1, 20) // PCM
  cabecera.writeUInt16LE(1, 22) // Mono
  cabecera.writeUInt32LE(16000, 24)
  cabecera.writeUInt32LE(32000, 28)
  cabecera.writeUInt16LE(2, 32)
  cabecera.writeUInt16LE(16, 34)
  cabecera.write('data', 36, 'ascii')
  cabecera.writeUInt32LE(pcm.byteLength, 40)
  return Buffer.concat([cabecera, Buffer.from(pcm)]).toString('base64')
}
