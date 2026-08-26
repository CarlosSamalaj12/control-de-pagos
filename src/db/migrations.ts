// src/db/migrations.ts
import { SCHEMA_V1_SQL } from './schema.sql';
import { execSql, qAll } from './client';

interface Migration {
  version: number;
  up: (db: any) => void;
}

function pickCol(db: any, table: string, oldName: string, newName: string): string {
  try {
    const exists = db.selectValue(
      `SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`,
      [table, oldName]
    );
    return Number(exists) > 0 ? oldName : newName;
  } catch {
    return newName;
  }
}

function tryExec(db: any, sql: string, label: string, silent = false) {
  try {
    db.exec(sql);
  } catch (e: any) {
    if (!silent) {
      console.log(`[migrations] ${label} skipped:`, e?.message ?? e);
    }
  }
}

function tableExists(db: any, table: string): boolean {
  try {
    const r = db.selectValue(
      `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`,
      [table]
    );
    return Number(r) > 0;
  } catch {
    return false;
  }
}

function colExists(db: any, table: string, col: string): boolean {
  try {
    const r = db.selectValue(
      `SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`,
      [table, col]
    );
    return Number(r) > 0;
  } catch {
    return false;
  }
}

const LEGACY_TEMP_TABLES = [
  'suscripciones_old',
  'suscripcion_participantes_old',
  'pagos_old',
];

function dropLegacyTempTables(db: any) {
  for (const t of LEGACY_TEMP_TABLES) {
    tryExec(db, `DROP TABLE IF EXISTS ${t}`, `cleanup ${t}`);
  }
}

function ensureCoreTables(db: any) {
  tryExec(db, `
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
    )
  `, 'ensure people');
  tryExec(db, `
    CREATE TABLE IF NOT EXISTS profiles (
      id          TEXT    PRIMARY KEY,
      nombre      TEXT    NOT NULL,
      pin_hash    TEXT    NOT NULL,
      person_id   TEXT    NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT
    )
  `, 'ensure profiles');
  tryExec(db, `
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
    )
  `, 'ensure suscripciones');
  tryExec(db, `
    CREATE TABLE IF NOT EXISTS ciclos (
      id                 TEXT    PRIMARY KEY,
      suscripcion_id     TEXT    NOT NULL,
      periodo            TEXT    NOT NULL,
      fecha_vencimiento  INTEGER NOT NULL,
      estado             TEXT    NOT NULL CHECK (estado IN ('pendiente','parcial','cobrado','vencido')),
      created_at         INTEGER NOT NULL,
      FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
      UNIQUE (suscripcion_id, periodo)
    )
  `, 'ensure ciclos');

  if (tableExists(db, 'suscripcion_participantes')) {
    tryExec(db, `
      CREATE TABLE suscripcion_participantes_new (
        suscripcion_id   TEXT    NOT NULL,
        people_id        TEXT    NOT NULL,
        cuota_esperada   REAL    NOT NULL CHECK (cuota_esperada >= 0),
        activo           INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (suscripcion_id, people_id),
        FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
        FOREIGN KEY (people_id)      REFERENCES people(id)      ON DELETE CASCADE
      )
    `, 'create sp_new');
    tryExec(db, `
      INSERT OR IGNORE INTO suscripcion_participantes_new (suscripcion_id, people_id, cuota_esperada, activo)
      SELECT suscripcion_id, people_id, cuota_esperada, activo FROM suscripcion_participantes
    `, 'copy sp -> sp_new');
    tryExec(db, 'DROP TABLE suscripcion_participantes', 'drop sp');
    tryExec(db, 'ALTER TABLE suscripcion_participantes_new RENAME TO suscripcion_participantes', 'rename sp_new -> sp');
    tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_sp_people ON suscripcion_participantes(people_id)', 'idx_sp_people', true);
  } else {
    tryExec(db, `
      CREATE TABLE IF NOT EXISTS suscripcion_participantes (
        suscripcion_id   TEXT    NOT NULL,
        people_id        TEXT    NOT NULL,
        cuota_esperada   REAL    NOT NULL CHECK (cuota_esperada >= 0),
        activo           INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (suscripcion_id, people_id),
        FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
        FOREIGN KEY (people_id)      REFERENCES people(id)      ON DELETE CASCADE
      )
    `, 'ensure suscripcion_participantes');
  }

  if (tableExists(db, 'pagos')) {
    tryExec(db, `
      CREATE TABLE pagos_new (
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
      )
    `, 'create pagos_new');
    tryExec(db, `
      INSERT OR IGNORE INTO pagos_new (id, ciclo_id, people_id, monto, fecha_pago, metodo, nota, created_at)
      SELECT id, ciclo_id, people_id, monto, fecha_pago, metodo, nota, created_at FROM pagos
    `, 'copy pagos -> pagos_new');
    tryExec(db, 'DROP TABLE pagos', 'drop pagos');
    tryExec(db, 'ALTER TABLE pagos_new RENAME TO pagos', 'rename pagos_new -> pagos');
    tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_pag_people ON pagos(people_id)', 'idx_pag_people', true);
    tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_pag_ciclo_peop ON pagos(ciclo_id, people_id)', 'idx_pag_ciclo_peop', true);
  } else {
    tryExec(db, `
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
      )
    `, 'ensure pagos');
  }
}

const migrations: Migration[] = [
  { version: 1, up: (db) => db.exec(SCHEMA_V1_SQL) },

  {
    // v2: rebuild `suscripciones` para ampliar el CHECK de `moneda` (agrega GTQ).
    version: 2,
    up: (db) => {
      if (!tableExists(db, 'suscripciones')) return;
      const oldPayerCol = pickCol(db, 'suscripciones', 'payer_profile_id', 'payer_people_id');
      tryExec(db, 'ALTER TABLE suscripciones RENAME TO suscripciones_old', 'rename suscripciones -> suscripciones_old');
      tryExec(db, `
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
          activo           INTEGER NOT NULL DEFAULT 1,
          notas            TEXT,
          created_at       INTEGER NOT NULL,
          updated_at       INTEGER NOT NULL,
          FOREIGN KEY (payer_people_id) REFERENCES people(id) ON DELETE RESTRICT
        )
      `, 'create suscripciones v2');
      tryExec(db, `
        INSERT INTO suscripciones (id, nombre, costo_total, moneda, periodicidad, dia_vencimiento, intervalo_dias, color, icono, payer_people_id, activo, notas, created_at, updated_at)
        SELECT id, nombre, costo_total, moneda, periodicidad, dia_vencimiento, intervalo_dias, color, icono, ${oldPayerCol}, activo, notas, created_at, updated_at
        FROM suscripciones_old
      `, 'copy data suscripciones_old -> suscripciones');
      tryExec(db, 'DROP TABLE IF EXISTS suscripciones_old', 'drop suscripciones_old');
      tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_susc_activo ON suscripciones(activo)', 'idx_susc_activo');
    },
  },

  {
    // v3: desacoplar "personas en suscripciones" de "usuarios de la app".
    version: 3,
    up: (db) => {
      tryExec(db, `
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
        )
      `, 'create people');
      tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_people_self ON people(is_self)', 'idx_people_self');

      tryExec(db, `
        INSERT OR IGNORE INTO people (id, nombre, color, iniciales, contacto, notas, is_self, created_at, updated_at)
        SELECT id, nombre,
               COALESCE(color, '#1F4E78'),
               COALESCE(iniciales, UPPER(SUBSTR(nombre, 1, 2))),
               contacto, notas, 1, created_at, updated_at
        FROM profiles
      `, 'seed people from profiles');

      if (!colExists(db, 'profiles', 'person_id')) {
        tryExec(db, 'ALTER TABLE profiles ADD COLUMN person_id TEXT', 'add profiles.person_id');
      }
      tryExec(db, 'UPDATE profiles SET person_id = id WHERE person_id IS NULL', 'set profiles.person_id');
      tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_profile_person ON profiles(person_id)', 'idx_profile_person', true);

      if (tableExists(db, 'suscripcion_participantes')) {
        const oldPartCol = pickCol(db, 'suscripcion_participantes', 'profile_id', 'people_id');
        if (oldPartCol === 'profile_id') {
          tryExec(db, 'ALTER TABLE suscripcion_participantes RENAME TO suscripcion_participantes_old', 'rename sp -> sp_old');
          tryExec(db, `
            CREATE TABLE suscripcion_participantes (
              suscripcion_id   TEXT    NOT NULL,
              people_id        TEXT    NOT NULL,
              cuota_esperada   REAL    NOT NULL CHECK (cuota_esperada >= 0),
              activo           INTEGER NOT NULL DEFAULT 1,
              PRIMARY KEY (suscripcion_id, people_id),
              FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
              FOREIGN KEY (people_id)      REFERENCES people(id)      ON DELETE CASCADE
            )
          `, 'create suscripcion_participantes');
          tryExec(db, `
            INSERT INTO suscripcion_participantes (suscripcion_id, people_id, cuota_esperada, activo)
            SELECT suscripcion_id, profile_id, cuota_esperada, activo
            FROM suscripcion_participantes_old
          `, 'copy sp_old -> suscripcion_participantes');
          tryExec(db, 'DROP TABLE IF EXISTS suscripcion_participantes_old', 'drop sp_old');
        }
      }
      tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_sp_people ON suscripcion_participantes(people_id)', 'idx_sp_people', true);

      if (tableExists(db, 'pagos')) {
        const oldPagoCol = pickCol(db, 'pagos', 'profile_id', 'people_id');
        if (oldPagoCol === 'profile_id') {
          tryExec(db, 'ALTER TABLE pagos RENAME TO pagos_old', 'rename pagos -> pagos_old');
          tryExec(db, `
            CREATE TABLE pagos (
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
            )
          `, 'create pagos');
          tryExec(db, `
            INSERT INTO pagos (id, ciclo_id, people_id, monto, fecha_pago, metodo, nota, created_at)
            SELECT id, ciclo_id, profile_id, monto, fecha_pago, metodo, nota, created_at
            FROM pagos_old
          `, 'copy pagos_old -> pagos');
          tryExec(db, 'DROP TABLE IF EXISTS pagos_old', 'drop pagos_old');
        }
      }
      tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_pag_people ON pagos(people_id)', 'idx_pag_people', true);
      tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_pag_ciclo_peop ON pagos(ciclo_id, people_id)', 'idx_pag_ciclo_peop', true);

      if (tableExists(db, 'suscripciones')) {
        const oldSuscPayerCol = pickCol(db, 'suscripciones', 'payer_profile_id', 'payer_people_id');
        if (oldSuscPayerCol === 'payer_profile_id') {
          tryExec(db, 'ALTER TABLE suscripciones RENAME TO suscripciones_old', 'rename suscripciones -> suscripciones_old');
          tryExec(db, `
            CREATE TABLE suscripciones (
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
              activo           INTEGER NOT NULL DEFAULT 1,
              notas            TEXT,
              created_at       INTEGER NOT NULL,
              updated_at       INTEGER NOT NULL,
              FOREIGN KEY (payer_people_id) REFERENCES people(id) ON DELETE RESTRICT
            )
          `, 'create suscripciones v3');
          tryExec(db, `
            INSERT INTO suscripciones (id, nombre, costo_total, moneda, periodicidad, dia_vencimiento, intervalo_dias, color, icono, payer_people_id, activo, notas, created_at, updated_at)
            SELECT id, nombre, costo_total, moneda, periodicidad, dia_vencimiento, intervalo_dias, color, icono, payer_profile_id, activo, notas, created_at, updated_at
            FROM suscripciones_old
          `, 'copy suscripciones_old -> suscripciones');
          tryExec(db, 'DROP TABLE IF EXISTS suscripciones_old', 'drop suscripciones_old');
        }
      }
      tryExec(db, 'CREATE INDEX IF NOT EXISTS idx_susc_activo ON suscripciones(activo)', 'idx_susc_activo', true);
    },
  },

  {
    // v4: agrega fecha_inicio a suscripciones. Si no se setea, se usa created_at.
    version: 4,
    up: (db) => {
      if (tableExists(db, 'suscripciones') && !colExists(db, 'suscripciones', 'fecha_inicio')) {
        tryExec(db, 'ALTER TABLE suscripciones ADD COLUMN fecha_inicio INTEGER', 'add suscripciones.fecha_inicio');
        tryExec(db, 'UPDATE suscripciones SET fecha_inicio = created_at WHERE fecha_inicio IS NULL', 'set fecha_inicio default');
      }
    },
  },

  {
    // v5: limpia tablas `*_old` que quedaron de migraciones anteriores
    // que fallaron a mitad de camino. Estas tablas rompen los INSERT a
    // `ciclos` con un error tipo "no such table: main.suscripciones_old"
    // porque algún artefacto del engine (FK, trigger, view) las referencia.
    version: 5,
    up: (db) => {
      // DROP TABLE IF EXISTS es seguro aunque la tabla no exista.
      // Hacemos el tryExec por cada una para que un fallo no impida
      // las otras limpiezas.
      tryExec(db, 'DROP TABLE IF EXISTS suscripciones_old', 'drop suscripciones_old');
      tryExec(db, 'DROP TABLE IF EXISTS suscripcion_participantes_old', 'drop suscripcion_participantes_old');
      tryExec(db, 'DROP TABLE IF EXISTS pagos_old', 'drop pagos_old');
      tryExec(db, 'DROP TABLE IF EXISTS profiles_old', 'drop profiles_old');
    },
  },

  {
    // v6: rebuild `ciclos` para arreglar FKs corruptas que apuntan a
    // tablas *_old (huérfanas). El síntoma típico: cada INSERT a
    // `ciclos` falla con "no such table: main.suscripciones_old"
    // porque el engine intenta validar la FK contra la tabla vieja.
    //
    // SQLite no permite DROP CONSTRAINT, así que el patrón es
    // RENAME → CREATE_NEW → COPY → DROP_OLD, idéntico al usado en
    // v2 y v3 para suscripciones.
    version: 6,
    up: (db) => {
      if (!tableExists(db, 'ciclos')) return;
      // Si la tabla `ciclos` no tiene la columna esperada, también
      // la reconstruimos (defensa adicional).
      const cols = qAll<any>(`PRAGMA table_info(ciclos)`);
      const tienePeriodo = cols.some((c) => c.name === 'periodo');
      if (tienePeriodo) {
        // Reconstruir `ciclos` con la FK correcta.
        tryExec(db, 'ALTER TABLE ciclos RENAME TO ciclos_old', 'rename ciclos -> ciclos_old');
        tryExec(
          db,
          `
          CREATE TABLE IF NOT EXISTS ciclos (
            id                 TEXT    PRIMARY KEY,
            suscripcion_id     TEXT    NOT NULL,
            periodo            TEXT    NOT NULL,
            fecha_vencimiento  INTEGER NOT NULL,
            estado             TEXT    NOT NULL CHECK (estado IN ('pendiente','parcial','cobrado','vencido')),
            created_at         INTEGER NOT NULL,
            FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
            UNIQUE (suscripcion_id, periodo)
          )
        `,
          'create ciclos v6'
        );
        tryExec(
          db,
          `
          INSERT INTO ciclos (id, suscripcion_id, periodo, fecha_vencimiento, estado, created_at)
          SELECT id, suscripcion_id, periodo, fecha_vencimiento, estado, created_at
          FROM ciclos_old
        `,
          'copy ciclos_old -> ciclos'
        );
        tryExec(db, 'DROP TABLE IF EXISTS ciclos_old', 'drop ciclos_old');
        tryExec(
          db,
          'CREATE INDEX IF NOT EXISTS idx_cic_periodo ON ciclos(periodo)',
          'idx_cic_periodo',
          true
        );
        tryExec(
          db,
          'CREATE INDEX IF NOT EXISTS idx_cic_estado ON ciclos(estado)',
          'idx_cic_estado',
          true
        );
        tryExec(
          db,
          'CREATE INDEX IF NOT EXISTS idx_cic_fecha ON ciclos(fecha_vencimiento)',
          'idx_cic_fecha',
          true
        );
      }
    },
  },

  {
    // v7: rebuild `pagos` y `suscripcion_participantes` para arreglar
    // FKs que quedaron apuntando a *_old después del rebuild de
    // `ciclos` (v6) o `suscripciones` (v2/v3). SQLite NO actualiza
    // las FKs de otras tablas cuando hacés ALTER TABLE RENAME, así
    // que después de cada rebuild hay que revisar las tablas que
    // apuntan al nombre viejo.
    //
    // El síntoma típico: el INSERT a `pagos` falla con
    // "no such table: main.ciclos_old" (porque `pagos.ciclo_id` FK
    // apunta a `ciclos_old` en vez de `ciclos`).
    version: 7,
    up: (db) => {
      // --- pagos ---
      if (tableExists(db, 'pagos')) {
        const pagosCols = qAll<any>(`PRAGMA table_info(pagos)`);
        const tieneMonto = pagosCols.some((c) => c.name === 'monto');
        if (tieneMonto) {
          tryExec(db, 'ALTER TABLE pagos RENAME TO pagos_old', 'rename pagos -> pagos_old');
          tryExec(
            db,
            `
            CREATE TABLE pagos (
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
            )
          `,
            'create pagos v7'
          );
          tryExec(
            db,
            `
            INSERT INTO pagos (id, ciclo_id, people_id, monto, fecha_pago, metodo, nota, created_at)
            SELECT id, ciclo_id, people_id, monto, fecha_pago, metodo, nota, created_at
            FROM pagos_old
          `,
            'copy pagos_old -> pagos'
          );
          tryExec(db, 'DROP TABLE IF EXISTS pagos_old', 'drop pagos_old');
          tryExec(
            db,
            'CREATE INDEX IF NOT EXISTS idx_pag_ciclo ON pagos(ciclo_id)',
            'idx_pag_ciclo',
            true
          );
          tryExec(
            db,
            'CREATE INDEX IF NOT EXISTS idx_pag_people ON pagos(people_id)',
            'idx_pag_people',
            true
          );
          tryExec(
            db,
            'CREATE INDEX IF NOT EXISTS idx_pag_ciclo_peop ON pagos(ciclo_id, people_id)',
            'idx_pag_ciclo_peop',
            true
          );
        }
      }

      // --- suscripcion_participantes ---
      if (tableExists(db, 'suscripcion_participantes')) {
        const spCols = qAll<any>(`PRAGMA table_info(suscripcion_participantes)`);
        const tieneCuota = spCols.some((c) => c.name === 'cuota_esperada');
        if (tieneCuota) {
          tryExec(db, 'ALTER TABLE suscripcion_participantes RENAME TO suscripcion_participantes_old', 'rename sp -> sp_old');
          tryExec(
            db,
            `
            CREATE TABLE suscripcion_participantes (
              suscripcion_id   TEXT    NOT NULL,
              people_id        TEXT    NOT NULL,
              cuota_esperada   REAL    NOT NULL CHECK (cuota_esperada >= 0),
              activo           INTEGER NOT NULL DEFAULT 1,
              PRIMARY KEY (suscripcion_id, people_id),
              FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
              FOREIGN KEY (people_id)      REFERENCES people(id)      ON DELETE CASCADE
            )
          `,
            'create sp v7'
          );
          tryExec(
            db,
            `
            INSERT INTO suscripcion_participantes (suscripcion_id, people_id, cuota_esperada, activo)
            SELECT suscripcion_id, people_id, cuota_esperada, activo
            FROM suscripcion_participantes_old
          `,
            'copy sp_old -> sp'
          );
          tryExec(db, 'DROP TABLE IF EXISTS suscripcion_participantes_old', 'drop sp_old');
          tryExec(
            db,
            'CREATE INDEX IF NOT EXISTS idx_sp_people ON suscripcion_participantes(people_id)',
            'idx_sp_people',
            true
          );
        }
      }
    },
  },

  {
    // v8: tabla `cuentas_pago` para guardar las cuentas bancarias /
    // tarjetas del emisor (el `people` con is_self=1) y mostrarlas
    // automáticamente en el pie del PDF "Estado de cuenta".
    //
    // Modelo 1:N entre people y cuentas. Una sola cuenta por
    // emisor puede tener `predeterminada = 1` (se garantiza en la
    // capa de aplicación, no con trigger SQL).
    version: 8,
    up: (db) => {
      tryExec(
        db,
        `
        CREATE TABLE IF NOT EXISTS cuentas_pago (
          id            TEXT    PRIMARY KEY,
          people_id     TEXT    NOT NULL,
          banco         TEXT    NOT NULL,
          tipo          TEXT    NOT NULL CHECK (tipo IN ('ahorro','monetaria','tarjeta','otra')),
          numero        TEXT    NOT NULL,
          predeterminada INTEGER NOT NULL DEFAULT 0,
          orden         INTEGER NOT NULL DEFAULT 0,
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL,
          FOREIGN KEY (people_id) REFERENCES people(id) ON DELETE CASCADE
        )
      `,
        'create cuentas_pago v8'
      );
      tryExec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_cuentas_pago_people ON cuentas_pago(people_id)',
        'idx_cuentas_pago_people',
        true
      );
      tryExec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_cuentas_pago_pred ON cuentas_pago(people_id, predeterminada)',
        'idx_cuentas_pago_pred',
        true
      );
    },
  },
];

export async function applyMigrations(db: any) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)'
  );
  const current = db.selectValue(
    'SELECT COALESCE(MAX(version), 0) FROM schema_version'
  ) as number;

  for (const m of migrations.filter((x) => x.version > current)) {
    db.exec('BEGIN');
    try {
      m.up(db);
      execSql('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [m.version, Date.now()]);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  ensureCoreTables(db);
  dropLegacyTempTables(db);

  const after = db.selectValue('SELECT COALESCE(MAX(version), 0) FROM schema_version') as number;
  if (after < 4) {
    db.exec('BEGIN');
    try {
      execSql('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)', [4, Date.now()]);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
    }
  }
}
