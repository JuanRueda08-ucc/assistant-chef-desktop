import { spawn, type ChildProcess } from 'node:child_process'
import type { ResultadoVozLocal } from '@shared/types/voz'

/** Lectura del paso con la voz instalada del sistema, sin Web Speech ni llamadas a IA. */
export function crearLectorLocal(): {
  leer: (texto: string) => Promise<ResultadoVozLocal>
  detener: () => void
} {
  let proceso: ChildProcess | null = null
  return {
    detener() {
      proceso?.kill()
      proceso = null
    },
    leer(texto) {
      proceso?.kill()
      return new Promise((resolve) => {
        const comando =
          process.platform === 'win32'
            ? 'powershell.exe'
            : process.platform === 'darwin'
              ? 'say'
              : 'espeak-ng'
        // Texto por stdin; nunca se interpola en código PowerShell ni comandos de shell.
        const argumentos =
          process.platform === 'win32'
            ? [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Speech; $lector = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voces = $lector.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'es-*' }; if ($voces.Count -gt 0) { $lector.SelectVoice(($voces | Select-Object -First 1).VoiceInfo.Name) }; $lector.Speak([Console]::In.ReadToEnd()); $lector.Dispose()"
              ]
            : process.platform === 'darwin'
              ? ['-f', '-']
              : ['-v', 'es', '--stdin']
        const actual = spawn(comando, argumentos, {
          windowsHide: true,
          stdio: ['pipe', 'ignore', 'ignore']
        })
        proceso = actual
        const reloj = setTimeout(() => actual.kill(), 120_000)
        const terminar = (ok: boolean): void => {
          clearTimeout(reloj)
          if (proceso === actual) proceso = null
          resolve(
            ok
              ? { ok: true }
              : {
                  ok: false,
                  mensaje:
                    'No pude leer el paso con la voz del sistema. Puedes leerlo en el globo del chef.'
                }
          )
        }
        actual.on('error', () => terminar(false))
        actual.on('exit', (codigo) => terminar(codigo === 0))
        actual.stdin?.on('error', () => {
          /* Proceso cancelado o sin lector instalado. */
        })
        actual.stdin?.end(texto, 'utf8')
      })
    }
  }
}
