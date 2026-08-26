// src/routes/Login.tsx
// Single PIN entry. No profile picker (single-profile por device).
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Wallet } from 'lucide-react';
import { useCurrentProfile } from '../hooks/useProfile';
import { useSessionStore } from '../stores/useSessionStore';
import { PinInput, NumericKeypad } from '../components/ui/PinInput';
import { Button } from '../components/ui/Button';
import { ProfileAvatar } from '../components/profile/ProfileAvatar';
import { isLocked } from '../lib/auth/lockout';

export function Login() {
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();
  const login = useSessionStore((s) => s.login);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockState, setLockState] = useState(isLocked());
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const l = isLocked();
      setLockState(l);
      if (!l.locked) force((x) => x + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const onKey = async (k: string) => {
    if (lockState.locked) return;
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (k === 'ok') {
      if (pin.length < 4) {
        setError('PIN mínimo 4 dígitos');
        return;
      }
      setError(null);
      const r = await login(pin);
      if (!r.ok) {
        setError(r.error ?? 'Error');
        setPin('');
        setLockState(isLocked());
      } else {
        navigate('/', { replace: true });
      }
    } else if (pin.length < 6) {
      setPin((p) => p + k);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No hay perfil todavía.</p>
          <Button onClick={() => navigate('/onboarding')}>Crear el primero</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto flex flex-col">
      <div className="text-center mt-4 mb-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-brand-primary flex items-center justify-center text-white mb-4">
          <Wallet size={36} />
        </div>
        <h1 className="text-2xl font-bold">Bienvenido</h1>
        <p className="text-slate-500 text-sm mt-1">Ingresá tu PIN para entrar</p>
      </div>

      <div className="flex flex-col items-center mb-6">
        <ProfileAvatar
          nombre={profile.nombre}
          iniciales={(profile.nombre || '?').slice(0, 2).toUpperCase()}
          color="#1F4E78"
          size="xl"
        />
        <div className="text-xl font-bold mt-3">{profile.nombre}</div>
      </div>

      <PinInput length={6} value={pin} onChange={setPin} />

      {lockState.locked ? (
        <div className="mt-4 text-center text-sm text-red-600 font-semibold">
          Bloqueado. Reintentá en {Math.ceil((lockState.remainingMs ?? 0) / 1000)}s.
        </div>
      ) : error ? (
        <div className="mt-4 text-center text-sm text-red-600 font-medium">{error}</div>
      ) : (
        <div className="mt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <Fingerprint size={14} />
          <span>{pin.length < 4 ? 'Ingresá tu PIN' : 'Tocá OK para entrar'}</span>
        </div>
      )}

      <div className="mt-6">
        <NumericKeypad onKey={onKey} disabled={lockState.locked} />
      </div>
    </div>
  );
}
