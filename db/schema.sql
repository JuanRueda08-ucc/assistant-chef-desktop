-- Esquema SQLite del chef digital. Debe coincidir con src/shared/types/ y docs/modelo-recetas.md
-- (un test lo comprueba: src/main/db/schema.test.ts).
--
-- Convenciones:
--   - Columnas en snake_case; los tipos TypeScript usan camelCase.
--   - Listas como JSON en TEXT, validadas con json_valid y json_type = 'array'.
--   - Booleanos como INTEGER 0/1.
--   - Enumeraciones con CHECK (... IN (...)).
--   - Idempotente: se ejecuta en cada arranque (CREATE ... IF NOT EXISTS).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredientes (
  id                   TEXT PRIMARY KEY,
  nombre               TEXT NOT NULL,
  sinonimos            TEXT NOT NULL DEFAULT '[]'
                       CHECK (json_valid(sinonimos) AND json_type(sinonimos) = 'array'),
  categoria            TEXT NOT NULL
                       CHECK (categoria IN ('verduras', 'frutas', 'proteinas', 'lacteos', 'cereales', 'legumbres', 'especias', 'despensa')),
  es_basico_despensa   INTEGER NOT NULL DEFAULT 0 CHECK (es_basico_despensa IN (0, 1)),
  alergenos            TEXT NOT NULL DEFAULT '[]'
                       CHECK (json_valid(alergenos) AND json_type(alergenos) = 'array'),
  dietas_incompatibles TEXT NOT NULL DEFAULT '[]'
                       CHECK (json_valid(dietas_incompatibles) AND json_type(dietas_incompatibles) = 'array'),
  densidad_g_ml        REAL CHECK (densidad_g_ml IS NULL OR densidad_g_ml > 0),
  peso_unidad_g        REAL CHECK (peso_unidad_g IS NULL OR peso_unidad_g > 0)
);

CREATE TABLE IF NOT EXISTS tecnicas (
  id           TEXT PRIMARY KEY,
  nombre       TEXT NOT NULL,
  descripcion  TEXT NOT NULL,
  pasos_cortos TEXT NOT NULL DEFAULT '[]'
               CHECK (json_valid(pasos_cortos) AND json_type(pasos_cortos) = 'array'),
  media        TEXT
);

CREATE TABLE IF NOT EXISTS recetas (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  titulo            TEXT NOT NULL,
  descripcion       TEXT NOT NULL,
  porciones_base    INTEGER NOT NULL CHECK (porciones_base > 0),
  tiempo_total_min  INTEGER NOT NULL CHECK (tiempo_total_min > 0),
  tiempo_activo_min INTEGER NOT NULL CHECK (tiempo_activo_min > 0 AND tiempo_activo_min <= tiempo_total_min),
  dificultad        TEXT NOT NULL CHECK (dificultad IN ('facil', 'media', 'avanzada')),
  origen            TEXT NOT NULL CHECK (origen IN ('revisada', 'generada')),
  estado_revision   TEXT NOT NULL CHECK (estado_revision IN ('borrador', 'revisada', 'retirada')),
  dietas            TEXT NOT NULL DEFAULT '[]'
                    CHECK (json_valid(dietas) AND json_type(dietas) = 'array'),
  alergenos         TEXT NOT NULL DEFAULT '[]'
                    CHECK (json_valid(alergenos) AND json_type(alergenos) = 'array'),
  equipo            TEXT NOT NULL DEFAULT '[]'
                    CHECK (json_valid(equipo) AND json_type(equipo) = 'array'),
  imagen            TEXT
);

CREATE INDEX IF NOT EXISTS recetas_estado_revision ON recetas (estado_revision);

CREATE TABLE IF NOT EXISTS receta_ingredientes (
  receta_id      TEXT NOT NULL REFERENCES recetas (id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  -- Posición en la lista de ingredientes de la receta (desde 1).
  posicion       INTEGER NOT NULL CHECK (posicion > 0),
  ingrediente_id TEXT NOT NULL REFERENCES ingredientes (id),
  cantidad       REAL CHECK (cantidad IS NULL OR cantidad > 0),
  unidad         TEXT NOT NULL CHECK (unidad IN ('g', 'ml', 'unidad', 'pizca', 'al_gusto')),
  escalado       TEXT NOT NULL DEFAULT 'lineal' CHECK (escalado IN ('lineal', 'suave', 'fijo')),
  redondeo       REAL CHECK (redondeo IS NULL OR redondeo > 0),
  preparacion    TEXT,
  grupo          TEXT,
  opcional       INTEGER NOT NULL DEFAULT 0 CHECK (opcional IN (0, 1)),
  PRIMARY KEY (receta_id, id),
  UNIQUE (receta_id, posicion),
  -- Solo `al_gusto` va sin cantidad, y todo lo que tiene cantidad tiene redondeo.
  CHECK ((unidad = 'al_gusto') = (cantidad IS NULL)),
  CHECK (cantidad IS NULL OR redondeo IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS pasos (
  receta_id             TEXT NOT NULL REFERENCES recetas (id) ON DELETE CASCADE,
  id                    TEXT NOT NULL,
  orden                 INTEGER NOT NULL CHECK (orden > 0),
  texto                 TEXT NOT NULL,
  texto_voz             TEXT,
  duracion_seg          INTEGER CHECK (duracion_seg IS NULL OR duracion_seg > 0),
  temporizador_etiqueta TEXT,
  temporizador_segundos INTEGER CHECK (temporizador_segundos IS NULL OR temporizador_segundos BETWEEN 10 AND 21600),
  senal_hecho           TEXT,
  tecnica_id            TEXT REFERENCES tecnicas (id),
  requiere_confirmacion INTEGER NOT NULL CHECK (requiere_confirmacion IN (0, 1)),
  consejo               TEXT,
  seguridad             TEXT,
  PRIMARY KEY (receta_id, id),
  UNIQUE (receta_id, orden),
  -- El temporizador del paso tiene etiqueta y segundos, o ninguno de los dos.
  CHECK ((temporizador_etiqueta IS NULL) = (temporizador_segundos IS NULL))
);

CREATE TABLE IF NOT EXISTS paso_ingredientes (
  receta_id             TEXT NOT NULL,
  paso_id               TEXT NOT NULL,
  ingrediente_receta_id TEXT NOT NULL,
  -- Posición dentro de la lista de ingredientes del paso (desde 1).
  posicion              INTEGER NOT NULL CHECK (posicion > 0),
  fraccion              REAL NOT NULL CHECK (fraccion > 0 AND fraccion <= 1),
  PRIMARY KEY (receta_id, paso_id, ingrediente_receta_id),
  FOREIGN KEY (receta_id, paso_id) REFERENCES pasos (receta_id, id) ON DELETE CASCADE,
  FOREIGN KEY (receta_id, ingrediente_receta_id) REFERENCES receta_ingredientes (receta_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sustituciones (
  id                     TEXT PRIMARY KEY,
  ingrediente_origen_id  TEXT NOT NULL REFERENCES ingredientes (id),
  ingrediente_destino_id TEXT NOT NULL REFERENCES ingredientes (id),
  ratio                  REAL NOT NULL CHECK (ratio > 0),
  receta_id              TEXT REFERENCES recetas (id) ON DELETE CASCADE,
  contexto               TEXT NOT NULL DEFAULT 'cualquiera' CHECK (contexto IN ('horneado', 'salteado', 'cualquiera')),
  resuelve               TEXT NOT NULL DEFAULT '[]'
                         CHECK (json_valid(resuelve) AND json_type(resuelve) = 'array'),
  impacto                TEXT NOT NULL,
  fuente                 TEXT NOT NULL CHECK (fuente IN ('revisada', 'generada')),
  CHECK (ingrediente_origen_id <> ingrediente_destino_id)
);

CREATE INDEX IF NOT EXISTS sustituciones_origen ON sustituciones (ingrediente_origen_id);

-- `SesionCocina` completa en `datos` (JSON validado con zod al leer). `fase` y `actualizada_en`
-- se copian a columnas para consultar sin abrir el JSON.
CREATE TABLE IF NOT EXISTS sesiones (
  id             TEXT PRIMARY KEY,
  fase           TEXT NOT NULL CHECK (fase IN ('preparar', 'elegir', 'cocinar', 'terminado')),
  datos          TEXT NOT NULL CHECK (json_valid(datos)),
  actualizada_en TEXT NOT NULL
);

-- Solo una sesión en fase `cocinar` a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS sesiones_una_cocinando ON sesiones (fase) WHERE fase = 'cocinar';
