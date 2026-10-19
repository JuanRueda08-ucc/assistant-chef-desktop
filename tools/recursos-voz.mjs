export const MODELO = {
  archivo: 'vosk-model-small-es-0.42.zip',
  carpeta: 'vosk-model-small-es-0.42',
  url: 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip',
  sha256: '09b239888f633ef2f0b4e09736e3d9936acfd810bc65d53fad45261762c6511f'
}

const release = (archivo, version, sha256, biblioteca) => ({
  archivo,
  carpeta: archivo.replace(/\.zip$/, ''),
  url: `https://github.com/alphacep/vosk-api/releases/download/v${version}/${archivo}`,
  sha256,
  biblioteca
})
const mac = release(
  'vosk-osx-0.3.42.zip',
  '0.3.42',
  '65395f196c9d0583d79949142b25560acaf9c295f36284e18433097f3adb0ea1',
  'libvosk.dylib'
)
export const NATIVOS = {
  'win32-x64': release(
    'vosk-win64-0.3.45.zip',
    '0.3.45',
    'f1dcc9cca460630f81ea8f71794f69c80bed6556d2a4e6237b5785e1d2dff34b',
    'libvosk.dll'
  ),
  'linux-x64': release(
    'vosk-linux-x86_64-0.3.45.zip',
    '0.3.45',
    'bbdc8ed85c43979f6443142889770ea95cbfbc56cffb5c5dcd73afa875c5fbb2',
    'libvosk.so'
  ),
  'linux-arm64': release(
    'vosk-linux-aarch64-0.3.45.zip',
    '0.3.45',
    '45e95d37755deb07568e79497d7feba8c03aee5a9e071df29961aa023fd94541',
    'libvosk.so'
  ),
  'darwin-x64': mac,
  'darwin-arm64': mac
}
