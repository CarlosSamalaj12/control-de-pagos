// src/components/layout/TopBar.tsx
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../stores/useSessionStore';
import { useCurrentProfile, usePeople } from '../../hooks/useProfile';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function TopBar() {
  const navigate = useNavigate();
  const logout = useSessionStore((s) => s.logout);
  const { profile } = useCurrentProfile();
  const { people } = usePeople();
  const [open, setOpen] = useState(false);

  const self = people.find((p: any) => p.is_self);

  if (!profile) return null;

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800 pt-safe">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="active:scale-95 transition" aria-label="Perfil">
            <ProfileAvatar
              nombre={self?.nombre ?? profile.nombre}
              iniciales={self?.iniciales ?? (profile.nombre || '?').slice(0, 2).toUpperCase()}
              color={self?.color ?? '#1F4E78'}
              size="md"
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-500">Hola,</div>
            <div className="font-semibold truncate">{self?.nombre ?? profile.nombre}</div>
          </div>
        </div>
      </header>

      <Modal open={open} onClose={() => setOpen(false)} title="Perfil">
        <div className="flex flex-col items-center py-4">
          <ProfileAvatar
            nombre={self?.nombre ?? profile.nombre}
            iniciales={self?.iniciales ?? (profile.nombre || '?').slice(0, 2).toUpperCase()}
            color={self?.color ?? '#1F4E78'}
            size="xl"
          />
          <div className="text-xl font-semibold mt-3">{self?.nombre ?? profile.nombre}</div>
        </div>
        <div className="space-y-2 mt-4">
          <Button variant="secondary" fullWidth onClick={() => { setOpen(false); navigate('/people'); }}>
            Administrar personas
          </Button>
          <Button variant="ghost" fullWidth onClick={() => { logout(); setOpen(false); }}>
            <LogOut size={18} /> Cerrar sesión
          </Button>
        </div>
      </Modal>
    </>
  );
}
