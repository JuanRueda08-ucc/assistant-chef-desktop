# 0027 · Más amarillo, modo claro y oscuro, pantalla de carga, bienvenida y animaciones

**Fecha:** 2026-11-17

**Contexto:** el autor, el día de la entrega, vio que la app funciona bien pero se ve plana: el blanco domina (menú lateral, despensa, chats, cuenta) y faltan animaciones, una pantalla de carga y una bienvenida. Pidió que el amarillo sea el protagonista y el blanco secundario. Revisó dos maquetas (`plan/diseno/punch-visual.html`): A «Girasol» (menú amarillo) y B «Tinta y girasol» (menú negro). Decidió tener las dos como modo claro y modo oscuro. Descartó una carga con la palabra «C(O)CINANDO» porque recordaba demasiado a su portafolio.

**Decisión:**
- **Tokens nuevos** en `tokens.css`: `--color-escenario` (bloques amarillos grandes), `--color-escenario-circulo`, `--color-sobre-acento` (texto sobre amarillo, igual en los dos modos), `--color-lateral*` (menú), `--color-pegatina`, `--sombra-tarjeta` y otros. Todo lo que tiene fondo amarillo lleva `color: var(--color-sobre-acento)`.
- **Clase `.sobre-amarillo`:** una zona amarilla que redefine los tokens de dentro. Los botones amarillos pasan a negros con letra amarilla, lo blanco sigue blanco y el texto es tinta en los dos modos. La usan el panel de la despensa, la columna de chats y la cabecera de «Mi cuenta».
- **Modo oscuro:** `:root[data-tema='oscuro']` redefine fondo, superficies, tinta y menú (negro con la opción activa en amarillo). Se elige en el menú lateral (Claro / Oscuro) y se guarda en `localStorage` (`chef.tema`), porque es una preferencia de este equipo. Lo amarillo sigue amarillo.
- **Inicio:** el saludo va en un gran bloque amarillo, con el chef que «respira», dibujos flotando en la mitad derecha y botones negro y blancos. Las fotos llevan un pie amarillo.
- **Menú lateral:** amarillo (claro) o negro (oscuro), con las opciones entrando escalonadas, el interruptor de modo y una tarjeta de cuenta con la inicial, en lugar del bloque de texto.
- **Pantalla de carga** (`componentes/Carga.svelte`): el chef sobre el amarillo con tres puntos que saltan, como poco 1,1 s mientras arranca; al terminar, la pantalla entera sube.
- **Bienvenida** (`pantallas/Bienvenida.svelte`): tres pasos, solo la primera vez que una cuenta entra en el equipo (`chef.bienvenida.<id>` en `localStorage`). Cada paso tiene su pose del chef (hablando, señalando, escuchando) y sus etiquetas flotando. La palabra resaltada es un bloque propio con interlineado, para no pisar la línea de arriba. Se puede usar con flechas y con «Saltar».
- **Animaciones** con CSS y transiciones de Svelte, sin librerías nuevas: cada pantalla entra subiendo; `.entra` con `--i` escalona fichas, filas y fotos; `respirar` y `flotar` para el chef y los dibujos. Con «reducir movimiento» del sistema se desactivan.

**Consecuencias:** el blanco queda para tarjetas y campos. Las pantallas que aún usan muchos `--color-superficie` (Elegir, Cocinar, Mis recetas) ya funcionan en oscuro por los tokens, pero no se han rehecho a fondo. Los colores sueltos de `.sobre-amarillo` y del modo oscuro viven solo en `tokens.css`.
