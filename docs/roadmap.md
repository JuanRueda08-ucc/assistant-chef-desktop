# Roadmap v1

Orden pensado para tener pronto algo que se pueda probar en la cocina. Marca `[x]` al terminar.

## Base
- [ ] 1. Proyecto electron-vite con Svelte + TypeScript, Vitest, ESLint, Prettier; comandos en `AGENTS.md`
- [ ] 2. SQLite en el proceso principal: crear desde `db/schema.sql`, cargar semillas validadas (zod) e IPC tipado
- [ ] 3. Esquemas zod que espejan `src/shared/types/` (se reusan para validar recetas generadas)

## Lógica pura (`src/shared/`, con tests)
- [ ] 4. Escalado de porciones y redondeo (`docs/modelo-recetas.md#adaptar-cantidades-porciones`)
- [ ] 5. Conversión a unidades caseras para mostrar
- [ ] 6. Derivar dietas y alérgenos desde el catálogo
- [ ] 7. Búsqueda y puntuación de recetas con "qué falta"
- [ ] 8. Reductor de `SesionCocina`: aplicar cada herramienta con sus precondiciones
- [ ] 9. Temporizadores basados en reloj (sobreviven a reinicios)

## Interfaz
- [ ] 10. Preparar: ingredientes por categoría y búsqueda, preferencias
- [ ] 11. Elegir: carrusel de recetas y panel "qué falta"
- [ ] 12. Cocinar: paso actual, ingredientes del paso, temporizadores, botones grandes
- [ ] 13. Componente `Avatar` con la interfaz `EstadoAvatar` (marcador estático primero, Rive después)

## IA y voz
- [ ] 14. `server/`: `POST /voz/token`, `POST /recetas/generar`, `POST /sustituciones/sugerir`
- [ ] 15. Órdenes cortas locales (siguiente, atrás, repite, pausa)
- [ ] 16. Sesión de voz en tiempo real con las herramientas del chef
- [ ] 17. Recetas generadas: validación, reintento y etiqueta en la interfaz

## Entrega
- [ ] 18. Semilla de 15–30 recetas revisadas con fotos licenciadas
- [ ] 19. Instaladores (electron-builder) para Windows, macOS y Linux
- [ ] 20. Medir costo y latencia por sesión de cocina; prueba con ruido real
