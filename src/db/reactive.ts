// src/db/reactive.ts
// Capa reactiva mínima sobre SQLite. ~50 LOC.
import { useEffect, useReducer } from 'react';

let _db: any = null;
let _version = 0;
const _subs = new Set<() => void>();
let _ready = false;
const _readySubs = new Set<(db: any) => void>();

export function setDb(db: any) {
  _db = db;
  _ready = true;
  _readySubs.forEach((fn) => fn(db));
}

export function getDb(): any {
  if (!_db) throw new Error('DB no inicializada — llamá initDb() antes de usar la base.');
  return _db;
}

export function isReady() {
  return _ready;
}

export function onReady(fn: (db: any) => void) {
  if (_ready) fn(_db);
  else _readySubs.add(fn);
}

export function bumpDbVersion() {
  _version++;
  _subs.forEach((fn) => fn());
}

export function getDbVersion() {
  return _version;
}

export function useDbVersion() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    _subs.add(force);
    return () => {
      _subs.delete(force);
    };
  }, []);
}

// Exponer para debugging en consola
declare global {
  interface Window {
    __db?: any;
    __bumpDb?: () => void;
    __dbVersion?: number;
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__db', { get: () => _db });
  Object.defineProperty(window, '__bumpDb', { value: bumpDbVersion });
  Object.defineProperty(window, '__dbVersion', { get: () => _version });
}
