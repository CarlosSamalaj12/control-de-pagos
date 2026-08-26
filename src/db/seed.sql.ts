// src/db/seed.sql.ts
// Categorías seed por profile + datos de muestra opcionales (suscripciones).
import { runInTransaction, execSql, getDb } from './client';
import { uid } from '../lib/id';

const SEED_CATEGORIES = [
  { nombre: 'Comida',     color: '#F4B084', icono: 'utensils',         tipo: 'expense' },
  { nombre: 'Transporte', color: '#5B9BD5', icono: 'car',              tipo: 'expense' },
  { nombre: 'Hogar',      color: '#70AD47', icono: 'home',             tipo: 'expense' },
  { nombre: 'Ocio',       color: '#A569BD', icono: 'film',             tipo: 'expense' },
  { nombre: 'Salud',      color: '#EC7063', icono: 'heart-pulse',      tipo: 'expense' },
  { nombre: 'Educación',  color: '#48C9B0', icono: 'graduation-cap',   tipo: 'expense' },
  { nombre: 'Ropa',       color: '#F7DC6F', icono: 'shirt',            tipo: 'expense' },
  { nombre: 'Servicios',  color: '#85929E', icono: 'lightbulb',        tipo: 'expense' },
  { nombre: 'Otros',      color: '#AAB7B8', icono: 'package',          tipo: 'expense' },
];

// Para finanzas personales — el profile_id se usa como owner de las categorías.
// Tomamos el profile activo (single-profile por device).
function getActiveProfileId(): string | null {
  const db = getDb();
  const v = db.selectValue('SELECT id FROM profiles ORDER BY created_at LIMIT 1');
  return (v as string) ?? null;
}

export async function ensureSeedCategories(_profileId: string) {
  // Mantiene la firma para compatibilidad. Crea categorías para el profile activo
  // si no tiene ninguna. Las categorías son por profile (no por people) porque
  // son parte de las finanzas PERSONALES del usuario.
  const profileId = getActiveProfileId();
  if (!profileId) return;

  const db = getDb();
  const existing = db.selectValue(
    'SELECT COUNT(*) FROM categories WHERE profile_id = ?',
    [profileId]
  ) as number;
  if (existing > 0) return;

  runInTransaction(() => {
    const now = Date.now();
    for (const c of SEED_CATEGORIES) {
      execSql(
        `INSERT INTO categories (id, profile_id, nombre, color, icono, tipo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid(), profileId, c.nombre, c.color, c.icono, c.tipo, now]
      );
    }
  });
}

const DEMO_PEOPLE = [
  { nombre: 'María',  color: '#C2185B', iniciales: 'MA' },
  { nombre: 'Juan',   color: '#2E75B6', iniciales: 'JU' },
  { nombre: 'Lucía',  color: '#70AD47', iniciales: 'LU' },
];

const DEMO_SUSCRIPCIONES = [
  { nombre: 'Netflix',         costo_total: 15.99, periodicidad: 'mensual', dia_vencimiento: 7,  color: '#E50914', icono: 'tv' },
  { nombre: 'Spotify',         costo_total: 11.99, periodicidad: 'mensual', dia_vencimiento: 12, color: '#1DB954', icono: 'music' },
  { nombre: 'iCloud+',         costo_total: 2.99,  periodicidad: 'mensual', dia_vencimiento: 1,  color: '#0070C9', icono: 'cloud' },
  { nombre: 'ChatGPT Plus',    costo_total: 20.0,  periodicidad: 'mensual', dia_vencimiento: 15, color: '#10A37F', icono: 'sparkles' },
  { nombre: 'YouTube Premium', costo_total: 13.99, periodicidad: 'mensual', dia_vencimiento: 20, color: '#FF0000', icono: 'play' },
];

/** Carga datos demo: personas roommates + suscripciones. Asume que el
 *  people del usuario actual (is_self=1) ya existe. */
export async function seedDemoData() {
  const db = getDb();
  const selfId = db.selectValue('SELECT id FROM people WHERE is_self = 1 LIMIT 1') as string | null;
  if (!selfId) throw new Error('No se encontró el people del usuario actual.');

  const now = Date.now();
  const roommateIds: string[] = [selfId];

  runInTransaction(() => {
    for (const p of DEMO_PEOPLE) {
      const id = uid();
      roommateIds.push(id);
      execSql(
        `INSERT INTO people (id, nombre, color, iniciales, contacto, notas, is_self, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)`,
        [id, p.nombre, p.color, p.iniciales, now, now]
      );
    }

    for (let i = 0; i < DEMO_SUSCRIPCIONES.length; i++) {
      const s = DEMO_SUSCRIPCIONES[i];
      const sid = uid();
      execSql(
        `INSERT INTO suscripciones (id, nombre, costo_total, moneda, periodicidad, dia_vencimiento, color, icono, payer_people_id, activo, created_at, updated_at)
         VALUES (?, ?, ?, 'GTQ', ?, ?, ?, ?, ?, 1, ?, ?)`,
        [sid, s.nombre, s.costo_total, s.periodicidad, s.dia_vencimiento, s.color, s.icono, selfId, now, now]
      );
      const counts = [4, 3, 4, 2, 3];
      const n = Math.min(counts[i], roommateIds.length);
      const cuota = +(s.costo_total / n).toFixed(2);
      for (let p = 0; p < n; p++) {
        execSql(
          `INSERT INTO suscripcion_participantes (suscripcion_id, people_id, cuota_esperada, activo)
           VALUES (?, ?, ?, 1)`,
          [sid, roommateIds[p], cuota]
        );
      }
    }
  });
}
