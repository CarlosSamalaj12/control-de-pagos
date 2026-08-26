// src/lib/auth/session.ts
const SESSION_KEY = 'auth:current-profile';
const EXPIRES_KEY = 'auth:session-expires';

export function setSession(profileId: string, ttlHours = 24) {
  try {
    sessionStorage.setItem(SESSION_KEY, profileId);
    sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + ttlHours * 3600 * 1000));
  } catch {
    /* sessionStorage no disponible */
  }
}

export function getSession(): string | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    const expires = parseInt(sessionStorage.getItem(EXPIRES_KEY) || '0', 10);
    if (!id || !Number.isFinite(expires) || expires < Date.now()) {
      clearSession();
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
  } catch {
    /* noop */
  }
}
