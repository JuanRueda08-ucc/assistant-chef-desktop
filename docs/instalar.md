# Instalar Chef digital

Las versiones están en **GitHub Releases**: https://github.com/JuanRueda08-ucc/assistant-chef-desktop/releases

Descarga el archivo de tu sistema desde la versión más reciente:

| Sistema | Archivo |
|---|---|
| Windows 10/11 (64 bits) | `assistant-chef-desktop-X.Y.Z-setup.exe` |
| macOS con chip M (M1, M2, M3…) | `assistant-chef-desktop-X.Y.Z-arm64.dmg` |
| Linux (64 bits) | `assistant-chef-desktop-X.Y.Z.AppImage` o `assistant-chef-desktop_X.Y.Z_amd64.deb` |

La app necesita internet para la cuenta y el chef. Funciona sin micrófono; la voz solo se activa en Cocinar cuando tú la enciendes.

## Windows

1. Abre el `.exe`. Si Windows muestra «Windows protegió tu PC», pulsa **Más información → Ejecutar de todas formas**. Sale porque la app aún no está firmada con un certificado de pago, no porque tenga algo malo.
2. Se instala sola y crea un acceso directo «Chef digital» en el escritorio.

## macOS (chip M)

1. Abre el `.dmg` y arrastra **Chef digital** a **Aplicaciones**.
2. La primera vez, en Aplicaciones, haz **clic derecho sobre Chef digital → Abrir** y confirma **Abrir**. macOS avisa porque la app no está firmada con una cuenta de desarrollador de Apple.
3. Si dice que la app «está dañada», abre Terminal y ejecuta:

   ```bash
   xattr -cr "/Applications/Chef digital.app"
   ```

   Luego ábrela de nuevo. Ese comando solo quita la marca de «descargado de internet».

Los Mac con procesador Intel no están incluidos por ahora.

## Linux

- **AppImage:** dale permiso de ejecución y ábrelo:

  ```bash
  chmod +x assistant-chef-desktop-*.AppImage && ./assistant-chef-desktop-*.AppImage
  ```

- **Debian/Ubuntu (.deb):**

  ```bash
  sudo apt install ./assistant-chef-desktop_*_amd64.deb
  ```

Para la voz «repetir» sin conexión hace falta `espeak-ng` (`sudo apt install espeak-ng`); sin él, la app muestra el texto.
