# 0003 · Forma de los datos, enumeraciones y semillas

**Fecha:** 2026-10-18

**Contexto:** los tipos de TypeScript, los esquemas zod y `db/schema.sql` deben coincidir (0002), y las recetas generadas por el modelo tendrán que validarse contra la misma definición. Había que decidir cómo representar los campos opcionales, qué listas son cerradas y cómo llegan las semillas a la base.

**Decisión:**
- Campos opcionales como `T | null` en tipos, JSON y SQLite (no `?:`); zod pone los valores por defecto al leer semillas.
- Cada esquema zod se compara con su interfaz en tiempo de compilación (`Afirmar<Igual<...>>`); un test compara los `CHECK` de `schema.sql` con las constantes de `src/shared/types/`.
- Listas cerradas para dietas, alérgenos (los 14 de la UE), equipo y categorías de ingrediente, para poder validar recetas generadas sin texto libre.
- `db/schema.sql` es idempotente (`IF NOT EXISTS`) y se ejecuta en cada arranque. Las semillas se empaquetan en el bundle de main (`import.meta.glob`), se validan con zod y se cargan en cada arranque en una transacción; cada receta de la semilla se reemplaza entera.
- `better-sqlite3` en el proceso principal; la misma compilación carga en Node y en Electron, así que los tests de base de datos corren con Vitest normal.

**Consecuencias:** un cambio de forma en un solo lado rompe `typecheck` o `test`. Añadir un valor a una lista cerrada exige tocar la constante y el `CHECK`. Aún no hay migraciones: cambiar una tabla existente requerirá un mecanismo de versión (`PRAGMA user_version`) antes de la primera versión publicada. Una receta borrada de la semilla no se elimina de bases ya creadas.
