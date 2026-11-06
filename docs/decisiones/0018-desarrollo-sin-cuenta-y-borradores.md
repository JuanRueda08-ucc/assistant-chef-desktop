# 0018 · Desarrollo sin cuenta y recetas sin revisar visibles en desarrollo

**Fecha:** 2026-11-05

**Contexto:** el autor aplaza el proyecto de Supabase. Con 0017 la app y el backend local no arrancaban sin sus datos, lo que bloqueaba todo el trabajo. Además, solo las recetas `revisada` aparecen al buscar, y las recetas nuevas deben quedar en `borrador` hasta que una persona las revise: sin esta decisión, Elegir seguiría vacío y no se podrían revisar dentro de la app.

**Decisión:**
- **Sin `CHEF_SUPABASE_URL` y `CHEF_SUPABASE_CLAVE_PUBLICA`, en desarrollo** la app entra sin login con `USUARIO_LOCAL` (`crearCuentaLocal`), sin token y sin botón «Salir». El backend local acepta las peticiones como ese usuario (`cuentasLocales`) y escucha solo en `127.0.0.1`. Con esos datos en `.env`, vuelve el login real sin tocar nada más.
- **Lo que sigue exigiendo cuenta:** la app empaquetada no arranca sin los datos de Supabase, el backend con `NODE_ENV=production` tampoco, y la Edge Function siempre verifica el JWT.
- **Borradores:** con la app sin empaquetar, `buscarEnBase` incluye los `borrador` con la etiqueta «Sin revisar» en Elegir. La app empaquetada solo muestra `revisada`. Las `retirada` no se muestran nunca.
- **Autoría de las recetas:** las recetas escritas por el agente quedan en `borrador`. Pasan a `revisada` solo cuando el autor las aprueba.

**Consecuencias:** se puede seguir desarrollando y revisar recetas sin servicios externos. Antes de empaquetar (tarea 19) hay que tener recetas aprobadas y los datos de Supabase; si no, la app no arranca o Elegir queda vacío. Los límites diarios del modo local se cuentan en memoria para ese único usuario.
