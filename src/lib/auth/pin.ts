// src/lib/auth/pin.ts
// Hash y verificación de PIN con PBKDF2 (Web Crypto API).
const ITER = 100_000;
const SALT_LEN = 16;
const KEY_LEN = 32;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPIN(pin: string): Promise<string> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN inválido: debe ser 4-6 dígitos numéricos.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN * 8
  );
  const hash = toBase64(new Uint8Array(bits));
  return `pbkdf2$${ITER}$${toBase64(salt)}$${hash}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPIN(pin: string, stored: string): Promise<boolean> {
  if (!pin || !stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iter = parseInt(parts[1], 10);
  if (!Number.isFinite(iter)) return false;
  const salt = fromBase64(parts[2]);
  const hash = parts[3];
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN * 8
  );
  const computed = toBase64(new Uint8Array(bits));
  return constantTimeEqual(computed, hash);
}
