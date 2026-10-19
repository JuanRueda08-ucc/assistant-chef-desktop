// Prueba nativa explícita: no forma parte de npm test y no descarga recursos ni usa red.
const { readdirSync, readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const { Worker } = require('node:worker_threads')

if (!process.versions.electron) {
  const r = spawnSync(require('electron'), [__filename, ...process.argv.slice(2)], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
    windowsHide: true
  })
  process.exit(r.status ?? 1)
}

const raiz = resolve(__dirname, '..')
const salida = join(raiz, 'out/main')
const nombreWorker = readdirSync(salida).find((nombre) => /^vosk-worker-.*\.js$/.test(nombre))
if (!nombreWorker) throw new Error('Compila la app antes: npm run build')
const carpeta = process.argv[2] ? resolve(process.argv[2]) : join(raiz, 'resources/voz')
const biblioteca =
  process.platform === 'win32'
    ? 'libvosk.dll'
    : process.platform === 'darwin'
      ? 'libvosk.dylib'
      : 'libvosk.so'
const worker = new Worker(join(salida, nombreWorker), {
  workerData: {
    biblioteca: join(carpeta, `${process.platform}-${process.arch}`, biblioteca),
    modelo: join(carpeta, 'vosk-model-small-es-0.42')
  }
})
let pcm = Buffer.alloc(32000)
if (process.argv[3]) {
  const wav = readFileSync(resolve(process.argv[3]))
  for (let pos = 12; pos + 8 <= wav.length;) {
    const tamano = wav.readUInt32LE(pos + 4)
    if (wav.toString('ascii', pos, pos + 4) === 'data') {
      pcm = Buffer.concat([wav.subarray(pos + 8, pos + 8 + tamano), Buffer.alloc(64000)])
      break
    }
    pos += 8 + tamano + (tamano % 2)
  }
}
const reloj = setTimeout(() => {
  console.error('Timeout Vosk')
  void worker.terminate()
  process.exitCode = 1
}, 30_000)
worker.on('error', (error) => {
  clearTimeout(reloj)
  console.error(error)
  process.exitCode = 1
})
worker.on('message', (r) => {
  if (r.error) {
    clearTimeout(reloj)
    console.error(r.error)
    worker.postMessage({ id: 2, accion: 'cerrar' })
    process.exitCode = 1
    return
  }
  if (r.id === 0) worker.postMessage({ id: 1, accion: 'audio', audio: new Uint8Array(pcm) })
  else {
    if (process.argv[3]) {
      console.info('ORDEN_RECONOCIDA', r.resultado)
      if (r.resultado?.texto !== 'siguiente' || r.resultado.confianza < 0.8) process.exitCode = 1
    }
    console.info(
      `VOSK_ELECTRON_OK Electron=${process.versions.electron} ${process.platform}-${process.arch}: modelo español, gramática y PCM en worker`
    )
    clearTimeout(reloj)
    worker.postMessage({ id: 2, accion: 'cerrar' })
  }
})
