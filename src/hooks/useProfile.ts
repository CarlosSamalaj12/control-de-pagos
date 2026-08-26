// src/hooks/useProfile.ts
// Single-profile por device. Carlos (o quien sea el usuario actual) tiene
// una sola fila en `profiles`. El "switcher" multi-profile se eliminó
// porque los roommates NO son usuarios de la app.
import { useQuery } from '../db/useQuery';
import { getDb, runInTransaction, execSql } from '../db/client';
import { rowToProfile, type Profile } from '../types';
import { uid } from '../lib/id';
import { hashPIN } from '../lib/auth/pin';
import { ensureSeedCategories } from '../db/seed.sql';

export function useCurrentProfile() {
  const { data, loading, error } = useQuery<any>(
    'SELECT * FROM profiles ORDER BY created_at LIMIT 1'
  );
  return {
    profile: data[0] ? rowToProfile(data[0]) : null,
    loading,
    error,
  };
}

export function usePeople() {
  const { data, loading, error } = useQuery<any>(
    'SELECT * FROM people ORDER BY is_self DESC, nombre'
  );
  return { people: data, loading, error };
}

export function usePerson(id: string | null) {
  const { data, loading, error } = useQuery<any>(
    'SELECT * FROM people WHERE id = ?',
    id ? [id] : []
  );
  return {
    person: data[0] ?? null,
    loading,
    error,
  };
}

export async function getCurrentPersonId(): Promise<string | null> {
  const db = getDb();
  const row = db.selectValue('SELECT id FROM people WHERE is_self = 1 LIMIT 1');
  return (row as string) ?? null;
}

export async function createFirstProfile(input: {
  nombre: string;
  color: string;
  pin: string;
}): Promise<{ profile: Profile; personId: string }> {
  if (!/^\d{4,6}$/.test(input.pin)) throw new Error('PIN inválido.');
  const db = getDb();
  const now = Date.now();
  const personId = uid();
  const profileId = uid();
  const pinHash = await hashPIN(input.pin);
  const iniciales = deriveIniciales(input.nombre);

  runInTransaction(() => {
    // 1. Crear el "people" del usuario actual
    execSql(
      `INSERT INTO people (id, nombre, color, iniciales, contacto, notas, is_self, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, 1, ?, ?)`,
      [personId, input.nombre.trim(), input.color, iniciales, now, now]
    );
    // 2. Crear el profile apuntando al people
    execSql(
      `INSERT INTO profiles (id, nombre, pin_hash, person_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [profileId, input.nombre.trim(), pinHash, personId, now, now]
    );
  });

  // 3. Crear categorías seed para el usuario actual
  await ensureSeedCategories(personId);

  return {
    profile: {
      id: profileId,
      nombre: input.nombre,
      pinHash,
      personId,
      createdAt: now,
      updatedAt: now,
    },
    personId,
  };
}

export async function createPerson(input: {
  nombre: string;
  color: string;
  contacto?: string;
  notas?: string;
}): Promise<string> {
  const id = uid();
  const now = Date.now();
  const iniciales = deriveIniciales(input.nombre);
  runInTransaction(() => {
    execSql(
      `INSERT INTO people (id, nombre, color, iniciales, contacto, notas, is_self, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, input.nombre.trim(), input.color, iniciales, input.contacto ?? null, input.notas ?? null, now, now]
    );
  });
  return id;
}

export async function updatePerson(
  id: string,
  patch: { nombre?: string; color?: string; contacto?: string; notas?: string }
) {
  const fields: string[] = [];
  const values: any[] = [];
  if (patch.nombre !== undefined) {
    fields.push('nombre = ?', 'iniciales = ?');
    values.push(patch.nombre, deriveIniciales(patch.nombre));
  }
  if (patch.color !== undefined) {
    fields.push('color = ?');
    values.push(patch.color);
  }
  if (patch.contacto !== undefined) {
    fields.push('contacto = ?');
    values.push(patch.contacto);
  }
  if (patch.notas !== undefined) {
    fields.push('notas = ?');
    values.push(patch.notas);
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(Date.now(), id);
  runInTransaction(() => {
    execSql(`UPDATE people SET ${fields.join(', ')} WHERE id = ?`, values);
  });
}

export async function deletePerson(id: string) {
  const db = getDb();
  // No se puede borrar al usuario actual
  const isSelf = db.selectValue('SELECT is_self FROM people WHERE id = ?', [id]);
  if (isSelf === 1) throw new Error('No podés borrar tu propio perfil.');
  runInTransaction(() => {
    execSql('DELETE FROM people WHERE id = ?', [id]);
  });
}

export async function changePin(newPin: string) {
  if (!/^\d{4,6}$/.test(newPin)) throw new Error('PIN inválido.');
  const pinHash = await hashPIN(newPin);
  const now = Date.now();
  runInTransaction(() => {
    execSql('UPDATE profiles SET pin_hash = ?, updated_at = ?', [pinHash, now]);
  });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const db = getDb();
  const hash = db.selectValue('SELECT pin_hash FROM profiles LIMIT 1') as string | null;
  if (!hash) return false;
  const { verifyPIN } = await import('../lib/auth/pin');
  return verifyPIN(pin, hash);
}

function deriveIniciales(nombre: string): string {
  const n = nombre.trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
