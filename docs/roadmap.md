# Roadmap v1

Orden pensado para tener pronto algo que se pueda probar en la cocina. Marca `[x]` al terminar.

## Prioridad revisada (2026-10-20)

El autor solicita conservar Mostaza y organizar mejor las pantallas existentes, sin repetir maquetas del flujo completo. Ver `replanteamiento-v1.md` y decisiones 0011–0012. Las casillas anteriores describen lo implementado; las nuevas cubren su revisión y aceptación.

- [x] 26. Registrar requisitos del replanteamiento, prioridad y cuentas reales para la v1
- [x] 27. Concretar agrupación, jerarquía y posiciones de controles sobre las pantallas existentes, conservando Mostaza y sin repetir maquetas del flujo completo
- [x] 28. Selección libre de múltiples ingredientes y gestión de los no reconocidos (los básicos se siguen asumiendo, 0014; lista libre en 0015)
- [x] 29. Autenticación real: registro, login, sesión persistente, cierre, protección del backend y definición de datos por cuenta (Better Auth, 0016; falta SMTP real y backend desplegado para que otras personas se registren)
- [x] 30. Aplicar la organización por pantalla con los componentes actuales y verificar jerarquía, estados y localización de controles con el autor (aplicada y aprobada por el autor el 2026-10-22)
- [x] 31. Registrar la primera prueba personal de voz/chat del autor (2026-10-21: irregular, con incidencias; no aceptada, repetir en 34)
- [x] 32. Comparar herramientas de autenticación real para Electron y el backend, con fuentes oficiales y sin elegir proveedor todavía
- [x] 33. Corregir conflicto entre consultas/órdenes, respuestas de otro paso y mensajes de error del chat; comprobar con PCM simulado, Vosk nativo y chat real sin micrófono del autor (0013)
- [ ] 34. Repetir prueba personal tras 33: explicar sin navegar, confirmar por voz, avanzar con narración y usar chat; registrar voz, latencia y fallos restantes en un lugar adecuado
- [x] 35. Investigar Vosk general frente a comandos y documentar LangChain/LangGraph para TypeScript, con evaluación del encaje sin adoptar dependencias
- [x] 36. Arrancar app y backend Gemini y comprobar los flujos existentes sin micrófono ni sonido; registrar el acceso de prueba a Cocinar, token/narración disponibles y timeout del chat, sin completar aceptación personal

La repetición de la prueba personal (34) queda aplazada por decisión del autor. La organización de pantallas (27 y 30) está aplicada y aprobada por el autor. Después concretar contratos de ingredientes/autenticación y coordinar 28–30. Comparación inicial en `autenticacion-opciones.md`; finalistas Better Auth y Supabase Auth. Retomar 17 sobre los contratos revisados; 18–20 siguen pendientes.

## Base
- [x] 1. Proyecto electron-vite con Svelte + TypeScript, Vitest, ESLint, Prettier; comandos en `AGENTS.md`
- [x] 2. SQLite en el proceso principal: crear desde `db/schema.sql`, cargar semillas validadas (zod) e IPC tipado
- [x] 3. Esquemas zod que espejan `src/shared/types/` (se reusan para validar recetas generadas)

## Lógica pura (`src/shared/`, con tests)
- [x] 4. Escalado de porciones y redondeo (`docs/modelo-recetas.md#adaptar-cantidades-porciones`)
- [x] 5. Conversión a unidades caseras para mostrar
- [x] 6. Derivar dietas y alérgenos desde el catálogo
- [x] 7. Búsqueda y puntuación de recetas con "qué falta"
- [x] 8. Reductor de `SesionCocina`: aplicar cada herramienta con sus precondiciones
- [x] 9. Temporizadores basados en reloj (sobreviven a reinicios)

## Interfaz
- [x] 10. Preparar: ingredientes por categoría y búsqueda, preferencias
- [x] 11. Elegir: carrusel de recetas y panel "qué falta"
- [x] 12. Cocinar: paso actual, ingredientes del paso, temporizadores, botones grandes
- [x] 13. Componente `Avatar` con la interfaz `EstadoAvatar` (marcador estático primero, Rive después)
- [x] 25. Impedir búsquedas sin ingredientes seleccionados y distinguir selección de básicos de despensa (feedback del autor)

## IA y voz
- [x] 24. Narración automática al entrar y avanzar, Gemini TTS con voz natural y respaldo local (feedback del autor, decisión 0009)
- [x] 14. `server/`: `POST /voz/token`, `POST /recetas/generar`, `POST /sustituciones/sugerir`
- [x] 15. Órdenes cortas locales con Vosk (chef, siguiente, atrás, repite, pausa, listo)
- [x] 16. Sesión de voz en tiempo real con Gemini Live y las herramientas del chef (adaptador `gemini` en `server/`; token, conexión y audio reales comprobados el 2026-10-20)
- [ ] 17. Recetas generadas: validación, reintento y etiqueta en la interfaz

## Chat con el chef (decisión 0007)
- [x] 21. Chat de texto en Cocinar con las 9 herramientas actuales
- [x] 22. Herramientas de Preparar y Elegir (marcar ingredientes, preferencias, buscar, ver y elegir receta) con su reductor puro y tests
- [x] 23. Chat de texto en Preparar y Elegir

## Entrega
- [ ] 18. Semilla de 15–30 recetas revisadas con fotos licenciadas
- [ ] 19. Instaladores (electron-builder) para Windows, macOS y Linux
- [ ] 20. Medir costo y latencia por sesión de cocina; prueba con ruido real
