// src/db/schema.sql.ts
// DDL v1 — fresh installs. Las migraciones v2 y v3 transforman DBs existentes.
export const SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT    PRIMARY KEY,
  nombre      TEXT    NOT NULL,
  pin_hash    TEXT    NOT NULL,
  person_id   TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS people (
  id          TEXT    PRIMARY KEY,
  nombre      TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  iniciales   TEXT    NOT NULL,
  contacto    TEXT,
  notas       TEXT,
  is_self     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_people_self ON people(is_self);

CREATE TABLE IF NOT EXISTS config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT    PRIMARY KEY,
  profile_id  TEXT    NOT NULL,
  nombre      TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  icono       TEXT    NOT NULL,
  tipo        TEXT    NOT NULL CHECK (tipo IN ('expense', 'income')),
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cat_profile ON categories(profile_id);

CREATE TABLE IF NOT EXISTS salary (
  id          TEXT    PRIMARY KEY,
  profile_id  TEXT    NOT NULL,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount      REAL    NOT NULL CHECK (amount >= 0),
  currency    TEXT    NOT NULL,
  notas       TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (profile_id, year, month),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sal_profile_ym ON salary(profile_id, year, month);

CREATE TABLE IF NOT EXISTS personal_expenses (
  id              TEXT    PRIMARY KEY,
  profile_id      TEXT    NOT NULL,
  category_id     TEXT,
  amount          REAL    NOT NULL CHECK (amount > 0),
  date            INTEGER NOT NULL,
  description     TEXT,
  payment_method  TEXT    CHECK (payment_method IN ('efectivo','tarjeta_debito','tarjeta_credito','transferencia','otro')),
  notas           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (profile_id)    REFERENCES profiles(id)    ON DELETE CASCADE,
  FOREIGN KEY (category_id)   REFERENCES categories(id)  ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pe_profile_date ON personal_expenses(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_pe_category     ON personal_expenses(category_id);

CREATE TABLE IF NOT EXISTS budgets (
  id           TEXT    PRIMARY KEY,
  profile_id   TEXT    NOT NULL,
  category_id  TEXT    NOT NULL,
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount       REAL    NOT NULL CHECK (amount >= 0),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE (profile_id, category_id, year, month),
  FOREIGN KEY (profile_id)  REFERENCES profiles(id)   ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id              TEXT    PRIMARY KEY,
  profile_id      TEXT    NOT NULL,
  nombre          TEXT    NOT NULL,
  target_amount   REAL    NOT NULL CHECK (target_amount > 0),
  current_amount  REAL    NOT NULL DEFAULT 0,
  deadline        INTEGER,
  color           TEXT    NOT NULL,
  icono           TEXT    NOT NULL,
  notas           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id          TEXT    PRIMARY KEY,
  goal_id     TEXT    NOT NULL,
  amount      REAL    NOT NULL CHECK (amount > 0),
  date        INTEGER NOT NULL,
  nota        TEXT,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gc_goal ON goal_contributions(goal_id);

CREATE TABLE IF NOT EXISTS suscripciones (
  id               TEXT    PRIMARY KEY,
  nombre           TEXT    NOT NULL,
  costo_total      REAL    NOT NULL CHECK (costo_total >= 0),
  moneda           TEXT    NOT NULL CHECK (moneda IN ('ARS','USD','EUR','GTQ')),
  periodicidad     TEXT    NOT NULL CHECK (periodicidad IN ('mensual','semanal','cada_n_dias')),
  dia_vencimiento  INTEGER,
  intervalo_dias   INTEGER,
  color            TEXT    NOT NULL,
  icono            TEXT    NOT NULL,
  payer_people_id  TEXT    NOT NULL,
  fecha_inicio     INTEGER NOT NULL,
  activo           INTEGER NOT NULL DEFAULT 1,
  notas            TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  FOREIGN KEY (payer_people_id) REFERENCES people(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_susc_activo ON suscripciones(activo);

CREATE TABLE IF NOT EXISTS suscripcion_participantes (
  suscripcion_id   TEXT    NOT NULL,
  people_id        TEXT    NOT NULL,
  cuota_esperada   REAL    NOT NULL CHECK (cuota_esperada >= 0),
  activo           INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (suscripcion_id, people_id),
  FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
  FOREIGN KEY (people_id)      REFERENCES people(id)      ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sp_people ON suscripcion_participantes(people_id);

CREATE TABLE IF NOT EXISTS ciclos (
  id                 TEXT    PRIMARY KEY,
  suscripcion_id     TEXT    NOT NULL,
  periodo            TEXT    NOT NULL,
  fecha_vencimiento  INTEGER NOT NULL,
  estado             TEXT    NOT NULL CHECK (estado IN ('pendiente','parcial','cobrado','vencido')),
  created_at         INTEGER NOT NULL,
  FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
  UNIQUE (suscripcion_id, periodo)
);
CREATE INDEX IF NOT EXISTS idx_cic_periodo ON ciclos(periodo);
CREATE INDEX IF NOT EXISTS idx_cic_estado  ON ciclos(estado);
CREATE INDEX IF NOT EXISTS idx_cic_fecha   ON ciclos(fecha_vencimiento);

CREATE TABLE IF NOT EXISTS pagos (
  id           TEXT    PRIMARY KEY,
  ciclo_id     TEXT    NOT NULL,
  people_id    TEXT    NOT NULL,
  monto        REAL    NOT NULL CHECK (monto > 0),
  fecha_pago   INTEGER NOT NULL,
  metodo       TEXT    CHECK (metodo IN ('transferencia','efectivo','tarjeta','otro')),
  nota         TEXT,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (ciclo_id)  REFERENCES ciclos(id)  ON DELETE CASCADE,
  FOREIGN KEY (people_id) REFERENCES people(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pag_ciclo      ON pagos(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_pag_people     ON pagos(people_id);
CREATE INDEX IF NOT EXISTS idx_pag_ciclo_peop ON pagos(ciclo_id, people_id);

CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;
