# 0014 · Seguir dando por hechos los básicos de despensa

**Fecha:** 2026-10-22

**Contexto:** `replanteamiento-v1.md` proponía contar solo los ingredientes añadidos explícitamente y dejar de suponer que la persona tiene sal, aceite, pimienta o agua. Antes de reorganizar Preparar y Elegir (tareas 27 y 30) había que decidir si se aplicaba.

**Decisión:** el autor elige mantener la suposición actual. Los ingredientes marcados como `esBasicoDespensa` en el catálogo se siguen dando por disponibles en la búsqueda, el recuento y el chat, y no cuentan como selección para buscar (`hayIngredientesSeleccionados`). La interfaz los distingue: Preparar los nombra bajo «Tu lista» («Damos por hecho que tienes…») y Elegir los marca como «Básico» y los suma aparte en la cobertura («N tuyos + M básicos»).

**Consecuencias:** no cambian `disponibilidad.ts`, la búsqueda ni sus pruebas. La propuesta de `replanteamiento-v1.md` queda descartada; la tarea 28 se centra en ingredientes libres y no reconocidos. Si más adelante se quiere que la persona confirme sus básicos, será una decisión nueva.
