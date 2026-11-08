# 0021 · Rediseño de la interfaz conservando el chef y el amarillo

**Fecha:** 2026-11-08

**Contexto:** el 2026-11-07 y el 2026-11-08 el autor, que estudia Diseño de Interfaces, dijo que la interfaz no le gusta. La ve desorganizada y con demasiada información. Los botones le parecen feos, y «Pedir ideas al chef», «Escribir al chef» y el temporizador no se notan. Un primer repaso con retoques (`diseno.md`) no bastó. Se le mostró una propuesta de tres pantallas (`plan/diseno/rediseno-43.html`, sin versionar) y la aprobó: «Sí, aplícala».

**Decisión:**
- **Se conserva:** el chef, el amarillo girasol, la tinta y las tipografías de 0005.
- **Cambia, respecto a 0005 y 0012:**
  - **Botones:** rectángulos redondeados (`--radio-boton`) sin contorno que se ven pulsables (`--sombra-boton`). Variantes principal (amarilla), oscura (la acción destacada sobre fondo amarillo) y secundaria (relleno suave). Desactivados: sin relleno y con borde de puntos. El trazo grueso queda para lo seleccionado.
  - **Fondo y colores:** fondo de azulejo `#f3f4ef`, relleno `--color-relleno` y verde `--color-hierba` para «Tienes todo».
  - **Cabecera:** los momentos son pestañas subrayadas. «Pregúntale al chef» es un botón oscuro con la cara del chef, salvo en Cocinar.
  - **Elegir:** tarjetas con foto o ilustración, y arriba una franja con «Pedir ideas al chef». Al pulsar una tarjeta se abre su detalle (`app.elegirDetalle`).
  - **Cocinar:** el temporizador va arriba en la columna del chef, en una tarjeta oscura con cuenta atrás o «Iniciar» del paso. Micrófono, voz y escribir son tres botones redondos con su nombre debajo.
  - **Chat:** la cara del chef en la cabecera, y micrófono y enviar como botones de ícono.

**Consecuencias:** reemplaza en esos puntos la regla de 0005 de que el trazo marca lo principal, y la organización de 0012 para Elegir y Cocinar. Las demás pantallas (Preparar, Retomar, Mis recetas) heredan los botones nuevos, pero su distribución no se rehízo. Faltan las fotos reales de las recetas (tarea 18).
