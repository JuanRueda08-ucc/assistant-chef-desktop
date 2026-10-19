# 0002 · Modelo de recetas y estado en la app

**Fecha:** 2026-10-18

**Contexto:** el chef debe adaptar recetas, llevar temporizadores y responder por voz sin perder el hilo ni inventar cantidades.

**Decisión:** un único esquema para recetas revisadas y generadas; unidades canónicas métricas; cantidades por paso derivadas con `fraccion`; escalado por ingrediente (`lineal`, `suave`, `fijo`); dietas y alérgenos derivados del catálogo. El estado (`SesionCocina`) vive en la app y solo cambia por herramientas validadas; el LLM no hace cálculos. Se añaden `ir_a_paso`, `controlar_temporizador` y `terminar_receta` a las seis herramientas iniciales.

**Consecuencias:** la lógica crítica es testeable sin IA; cambiar de proveedor de IA no afecta los datos; las recetas generadas necesitan validación antes de mostrarse.
