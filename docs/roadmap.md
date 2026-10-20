# Roadmap v1

Orden pensado para tener pronto algo que se pueda probar en la cocina. Marca `[x]` al terminar.

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

## IA y voz
- [x] 24. Narración automática al entrar y avanzar, Gemini TTS con voz natural y respaldo local (feedback del autor, decisión 0009)
- [x] 14. `server/`: `POST /voz/token`, `POST /recetas/generar`, `POST /sustituciones/sugerir`
- [x] 15. Órdenes cortas locales con Vosk (chef, siguiente, atrás, repite, pausa, listo)
- [x] 16. Sesión de voz en tiempo real con Gemini Live y las herramientas del chef (adaptador `gemini` en `server/`)
- [ ] 17. Recetas generadas: validación, reintento y etiqueta en la interfaz

## Chat con el chef (decisión 0007)
- [x] 21. Chat de texto en Cocinar con las 9 herramientas actuales
- [x] 22. Herramientas de Preparar y Elegir (marcar ingredientes, preferencias, buscar, ver y elegir receta) con su reductor puro y tests
- [x] 23. Chat de texto en Preparar y Elegir

## Entrega
- [ ] 18. Semilla de 15–30 recetas revisadas con fotos licenciadas
- [ ] 19. Instaladores (electron-builder) para Windows, macOS y Linux
- [ ] 20. Medir costo y latencia por sesión de cocina; prueba con ruido real
