# 0028 · Versiones en GitHub Releases para Windows, macOS y Linux

**Fecha:** 2026-11-17

**Contexto:** la entrega exige que la app se pueda descargar e instalar en Windows, Linux y Mac (tarea 19), y el autor quiere publicar una versión nueva cada vez que haga cambios. Las 18 recetas seguían en `borrador`, y la app instalada solo muestra las revisadas. No hay certificados de firma: ni de Windows ni de cuenta de desarrollador de Apple.

**Decisión:**
- **GitHub Actions** (`.github/workflows/version.yml`) publica una versión al subir una etiqueta `vX.Y.Z` que coincide con `version` de `package.json`. Un trabajo crea la versión con notas automáticas y otros tres compilan, cada uno en su sistema, con tests, Vosk de su plataforma y `electron-builder --publish always`, y suben los archivos a esa versión:
  - Windows x64: `.exe` (NSIS).
  - macOS arm64: `.dmg` y `.zip`.
  - Linux x64: `.AppImage` y `.deb`.
- **Para publicar otra:** `npm version patch` (o `minor`/`major`) y `git push --follow-tags`.
- **Sin firma de pago:** en Windows sale el aviso de SmartScreen. En macOS se firma ad hoc (`identity: '-'`, sin hardened runtime), para que abra en chips M con «clic derecho → Abrir» o `xattr -cr`. Los pasos para quien instala están en `docs/instalar.md`. Firmar y notarizar exigirá un certificado de Windows y la cuenta de Apple Developer.
- **Sin Mac Intel ni Linux arm64 por ahora:** los módulos nativos (better-sqlite3, Koffi y Vosk) se compilan para la máquina que construye, y cada arquitectura necesita la suya.
- **Valores públicos en el flujo:** URL de la función, URL de Supabase y clave publicable. Son los mismos que ya van dentro de la app; ningún secreto.
- **Recetas aprobadas:** el autor aprobó las 18 de la semilla (`estadoRevision: revisada`) para la versión 1.0.0. Los tests que comprueban el filtro de borradores marcan ahora sus propios borradores.
- **Se quita el destino `snap`** de Linux, que exige snapcraft y una cuenta en la tienda.

**Consecuencias:** cada versión tarda unos 10-15 minutos en compilar en GitHub. Un fallo en un sistema no impide que se publiquen los demás (`fail-fast: false`); se puede repetir el trabajo desde Actions. La app no se actualiza sola: quien la tenga descarga la versión nueva.
