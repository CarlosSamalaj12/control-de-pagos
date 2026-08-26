// src/lib/auth/lockout.ts
const ATTEMPTS_KEY = 'auth:failed-attempts';
const LOCKOUT_KEY = 'auth:lockout-until';

export function recordFailedAttempt(): number {
  const cur = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) || 0;
  const attempts = cur + 1;
  sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));
  if (attempts >= 10) {
    sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + 5 * 60 * 1000));
  } else if (attempts >= 5) {
    sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + 30 * 1000));
  }
  return attempts;
}

export function isLocked(): { locked: boolean; remainingMs?: number } {
  const until = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10) || 0;
  if (until > Date.now()) {
    return { locked: true, remainingMs: until - Date.now() };
  }
  if (until > 0) {
    sessionStorage.removeItem(LOCKOUT_KEY);
    sessionStorage.removeItem(ATTEMPTS_KEY);
  }
  return { locked: false };
}

export function resetAttempts() {
  try {
    sessionStorage.removeItem(ATTEMPTS_KEY);
    sessionStorage.removeItem(LOCKOUT_KEY);
  } catch {
    /* noop */
  }
}

export function getAttempts(): number {
  return parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) || 0;
}
