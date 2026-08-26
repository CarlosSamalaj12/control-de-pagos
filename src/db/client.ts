// src/db/client.ts
// Singleton de SQLite WASM con persistencia en OPFS y fallback a IDB.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { applyMigrations } from './migrations';
import { bumpDbVersion, setDb as setDbReactive, getDb as getDbReactive } from './reactive';

type Mode = 'opfs' | 'idb';

let _initPromise: Promise<Mode> | null = null;
let _mode: Mode = 'opfs';
let _db: any = null;
let _sqlite3: any = null; // referencia al módulo (para acceder a capi/wasm en serialización)

const IDB_SNAPSHOT_KEY = 'sqlite-snapshot-v1';

export async function initDb(): Promise<Mode> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const sqlite3 = await sqlite3InitModule({
      print: () => {},
      printErr: console.error,
    });
    _sqlite3 = sqlite3;

    if (typeof sqlite3.oo1.OpfsDb === 'function') {
      try {
        _db = new sqlite3.oo1.OpfsDb('/control-pagos.sqlite3', 'ct');
        _mode = 'opfs';
      } catch (e) {
        console.warn('[db] OPFS no disponible, fallback a IDB:', e);
        _db = new sqlite3.oo1.DB(':memory:');
        _mode = 'idb';
      }
    } else {
      _db = new sqlite3.oo1.DB(':memory:');
      _mode = 'idb';
    }

    if (_mode === 'idb') {
      const blob = (await idbGet(IDB_SNAPSHOT_KEY)) as Blob | undefined;
      if (blob) {
        try {
          const buf = new Uint8Array(await blob.arrayBuffer());
          const ok = deserializeDb(_db, buf);
          if (!ok) console.warn('[db] sqlite3_deserialize devolvió error, empezando vacío');
        } catch (e) {
          console.warn('[db] snapshot IDB corrupto, empezando vacío:', e);
        }
      }
    }

    try {
      _db.exec('PRAGMA foreign_keys = ON');
    } catch {
      /* some WASM builds may not support PRAGMA before tables exist */
    }
    try {
      _db.exec('PRAGMA journal_mode = WAL');
    } catch {
      /* IDB mode no soporta WAL, ignorar */
    }

    setDbReactive(_db);
    await applyMigrations(_db);
    return _mode;
  })();

  return _initPromise;
}

export function getMode(): Mode {
  return _mode;
}

export function getDb(): any {
  return getDbReactive();
}

// ============================================================================
// Query helpers — la API real de @sqlite.org/sqlite-wasm usa `bind` (no
// `params`) en el object-form de `exec`. Estos wrappers centralizan el uso
// correcto para no repetir la sintaxis en todos los hooks.
// ============================================================================

export function execSql(sql: string, params: any[] = []): any {
  if (!params || params.length === 0) {
    return _db.exec(sql);
  }
  return _db.exec({ sql, bind: params });
}

export function qScalar<T = any>(sql: string, params: any[] = [], fallback: T | null = null): T | null {
  if (!_db) throw new Error('DB no inicializada');
  const result = params.length === 0
    ? _db.exec({ sql, returnValue: 'resultRows', rowMode: 'array' })
    : _db.exec({ sql, bind: params, returnValue: 'resultRows', rowMode: 'array' });
  if (!result || result.length === 0) return fallback;
  const first = result[0];
  return (first && first.length > 0 ? first[0] : fallback) as T | null;
}

export function qAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!_db) throw new Error('DB no inicializada');
  if (params.length === 0) {
    return _db.exec({ sql, returnValue: 'resultRows', rowMode: 'object' }) as T[];
  }
  return _db.exec({ sql, bind: params, returnValue: 'resultRows', rowMode: 'object' }) as T[];
}

export function runInTransaction(fn: () => void) {
  if (!_db) throw new Error('DB no inicializada');
  _db.exec('BEGIN');
  try {
    fn();
    _db.exec('COMMIT');
    bumpDbVersion();
    if (_mode === 'idb') {
      scheduleIdbSnapshot();
    }
  } catch (e) {
    _db.exec('ROLLBACK');
    throw e;
  }
}

// ============================================================================
// Serialización / deserialización de la DB completa (solo IDB, OPFS persiste
// solo). El método `_db.serialize()` / `_db.deserialize()` NO existen en la
// API de oo1 del `@sqlite.org/sqlite-wasm`. Hay que usar las funciones
// C-level `sqlite3__wasm_db_serialize` / `sqlite3_deserialize` vía el
// módulo sqlite3.
// ============================================================================
function serializeDb(db: any): Uint8Array {
  if (!_sqlite3) throw new Error('sqlite3 module no disponible');
  const wasm = _sqlite3.wasm;
  const capi = _sqlite3.capi;
  const pDb = db.pointer;
  if (!pDb) throw new Error('DB sin pointer');

  const scope = wasm.scopedAllocPush();
  try {
    const ppOut = wasm.alloc(8);
    const pSize = wasm.alloc(8);
    const zSchema = wasm.scopedAllocCString('main');
    const rc = wasm.exports.sqlite3__wasm_db_serialize(pDb, zSchema, ppOut, pSize, 0);
    if (rc) {
      const msg = capi.sqlite3_js_rc_str ? capi.sqlite3_js_rc_str(rc) : `code ${rc}`;
      throw new Error(`serialize failed: ${msg}`);
    }
    const pOut = Number(wasm.peekPtr(ppOut));
    const nOut = Number(wasm.peek(pSize, 'i64'));
    const out = nOut > 0 ? wasm.heap8u().slice(pOut, pOut + nOut).slice() : new Uint8Array();
    if (pOut) capi.sqlite3_free(pOut);
    return out;
  } finally {
    wasm.scopedAllocPop(scope);
  }
}

function deserializeDb(db: any, data: Uint8Array): boolean {
  if (!_sqlite3) throw new Error('sqlite3 module no disponible');
  const wasm = _sqlite3.wasm;
  const capi = _sqlite3.capi;
  const pDb = db.pointer;
  if (!pDb) throw new Error('DB sin pointer');

  const scope = wasm.scopedAllocPush();
  try {
    // Reservamos memoria WASM y copiamos los datos del blob.
    // Usamos SQLITE_DESERIALIZE_FREEONCLOSE para que SQLite tome ownership
    // de la memoria y la libere al cerrar la DB.
    // Usamos SQLITE_DESERIALIZE_RESIZEABLE para permitir que SQLite haga
    // realloc si necesita.
    const pBuf = wasm.alloc(data.length);
    wasm.heap8u().set(data, pBuf);
    const zSchema = wasm.scopedAllocCString('main');
    const FREEONCLOSE = capi.SQLITE_DESERIALIZE_FREEONCLOSE ?? 1;
    const RESIZEABLE = capi.SQLITE_DESERIALIZE_RESIZEABLE ?? 2;
    const flags = FREEONCLOSE | RESIZEABLE;
    const rc = capi.sqlite3_deserialize(
      pDb, zSchema, pBuf, data.length, data.length, flags
    );
    if (rc !== 0) {
      const msg = capi.sqlite3_js_rc_str ? capi.sqlite3_js_rc_str(rc) : `code ${rc}`;
      console.warn('[db] sqlite3_deserialize:', msg);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[db] deserialize falló:', e);
    return false;
  } finally {
    wasm.scopedAllocPop(scope);
  }
}

let _snapshotTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleIdbSnapshot() {
  if (_snapshotTimer) clearTimeout(_snapshotTimer);
  _snapshotTimer = setTimeout(async () => {
    try {
      const data = serializeDb(_db);
      await idbSet(IDB_SNAPSHOT_KEY, new Blob([data as BlobPart]));
    } catch (e) {
      console.error('[db] snapshot IDB falló:', e);
    }
  }, 400);
}

export async function exportDatabaseBinary(): Promise<Uint8Array> {
  if (!_db) throw new Error('DB no inicializada');
  if (_mode === 'opfs') {
    // En OPFS la DB ya está en disco. Para export, podemos usar el C API también.
    return serializeDb(_db);
  }
  return serializeDb(_db);
}

export async function wipeAllData() {
  if (!_db) throw new Error('DB no inicializada');
  const tables = [
    'goal_contributions',
    'savings_goals',
    'budgets',
    'personal_expenses',
    'salary',
    'categories',
    'pagos',
    'cuentas_pago',
    'ciclos',
    'suscripcion_participantes',
    'suscripciones',
    'config',
    'profiles',
    'people',
  ];
  _db.exec('BEGIN');
  try {
    for (const t of tables) {
      try {
        _db.exec(`DELETE FROM ${t}`);
      } catch {
        /* tabla no existe, ignorar */
      }
    }
    _db.exec('COMMIT');
    bumpDbVersion();
    if (_mode === 'idb') {
      await idbDel(IDB_SNAPSHOT_KEY);
    }
  } catch (e) {
    _db.exec('ROLLBACK');
    throw e;
  }
}
