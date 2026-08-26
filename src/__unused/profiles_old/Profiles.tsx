// src/routes/profiles/Profiles.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, KeyRound } from 'lucide-react';
import { useProfiles, createProfile, deleteProfile, changePin, updateProfile } from '../../hooks/useProfile';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PinInput, NumericKeypad } from '../../components/ui/PinInput';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { useUIStore } from '../../stores/useUIStore';
import { useSessionStore } from '../../stores/useSessionStore';

const COLORS = ['#1F4E78', '#2E75B6', '#70AD47', '#C2185B', '#E67E22', '#8E44AD', '#16A085', '#34495E'];

export function Profiles() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const { profiles } = useProfiles();
  const currentProfileId = useSessionStore((s) => s.currentProfileId);

  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Perfiles</h2>
      </div>

      <div className="space-y-2">
        {profiles.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center gap-3">
              <ProfileAvatar nombre={p.nombre} iniciales={p.iniciales} color={p.color} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  {p.nombre}
                  {p.id === currentProfileId && <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full">vos</span>}
                </div>
                {p.isAdmin && <div className="text-xs text-slate-500">Admin</div>}
              </div>
              <button onClick={() => setEditId(p.id)} className="p-2 text-slate-500 hover:text-brand-primary">
                <Edit2 size={16} />
              </button>
              <button onClick={() => setPinId(p.id)} className="p-2 text-slate-500 hover:text-brand-primary">
                <KeyRound size={16} />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`¿Eliminar perfil "${p.nombre}"?`)) return;
                  await deleteProfile(p.id);
                  showToast('Perfil eliminado', 'success');
                }}
                className="p-2 text-slate-500 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Button fullWidth onClick={() => setNewOpen(true)}>
        <Plus size={18} /> Nuevo perfil
      </Button>

      <NuevoProfileModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={async (data) => {
          await createProfile({ ...data, isAdmin: false });
          showToast('Perfil creado', 'success');
          setNewOpen(false);
        }}
      />

      {editId && (() => {
        const p = profiles.find((x) => x.id === editId);
        if (!p) return null;
        return (
          <EditarProfileModal
            open
            profile={p}
            onClose={() => setEditId(null)}
            onSave={async (data) => {
              await updateProfile(p.id, data);
              showToast('Perfil actualizado', 'success');
              setEditId(null);
            }}
          />
        );
      })()}

      {pinId && (
        <CambiarPinModal
          profileId={pinId}
          onClose={() => setPinId(null)}
          onSave={async (pin) => {
            await changePin(pinId, pin);
            showToast('PIN actualizado', 'success');
            setPinId(null);
          }}
        />
      )}
    </div>
  );
}

function NuevoProfileModal({ open, onClose, onCreate }: any) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [step, setStep] = useState<'name' | 'pin' | 'confirm'>('name');

  const reset = () => { setNombre(''); setColor(COLORS[0]); setPin(''); setPinConfirm(''); setStep('name'); };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo perfil">
      {step === 'name' && (
        <div className="space-y-3">
          <Field label="Nombre">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" autoFocus />
          </Field>
          <Field label="Color">
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`w-9 h-9 rounded-full ${color === c ? 'ring-4 ring-offset-2 ring-brand-primary/40' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </Field>
          <Button fullWidth size="lg" onClick={() => nombre.trim().length >= 2 && setStep('pin')}>
            Siguiente
          </Button>
        </div>
      )}
      {(step === 'pin' || step === 'confirm') && (
        <div className="space-y-3">
          <div className="text-center text-sm text-slate-500 mb-2">
            {step === 'pin' ? 'Elegí un PIN (4-6 dígitos)' : 'Confirmá el PIN'}
          </div>
          <PinInput length={6} value={step === 'pin' ? pin : pinConfirm} onChange={() => {}} />
          <NumericKeypad
            onKey={(k) => {
              const target = step === 'pin' ? pin : pinConfirm;
              const setTarget = step === 'pin' ? setPin : setPinConfirm;
              if (k === 'del') setTarget(target.slice(0, -1));
              else if (k === 'ok') {
                if (step === 'pin') {
                  if (pin.length < 4) return;
                  setStep('confirm');
                } else {
                  if (pin !== pinConfirm) {
                    alert('Los PINs no coinciden');
                    setPin(''); setPinConfirm(''); setStep('pin');
                    return;
                  }
                  onCreate({ nombre, color, pin });
                }
              } else if (target.length < 6) setTarget(target + k);
            }}
          />
        </div>
      )}
    </Modal>
  );
}

function EditarProfileModal({ open, profile, onClose, onSave }: any) {
  const [nombre, setNombre] = useState(profile.nombre);
  const [color, setColor] = useState(profile.color);
  return (
    <Modal open={open} onClose={onClose} title="Editar perfil">
      <div className="space-y-3">
        <Field label="Nombre">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Field label="Color">
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`w-9 h-9 rounded-full ${color === c ? 'ring-4 ring-offset-2 ring-brand-primary/40' : ''}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </Field>
        <Button fullWidth onClick={() => onSave({ nombre, color })}>Guardar</Button>
      </div>
    </Modal>
  );
}

function CambiarPinModal({ profileId, onClose, onSave }: any) {
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [step, setStep] = useState<'pin' | 'confirm'>('pin');
  return (
    <Modal open={true} onClose={onClose} title="Cambiar PIN">
      <div className="text-center text-sm text-slate-500 mb-2">
        {step === 'pin' ? 'Nuevo PIN (4-6 dígitos)' : 'Confirmá el PIN'}
      </div>
      <PinInput length={6} value={step === 'pin' ? pin : pinConfirm} onChange={() => {}} />
      <div className="mt-3">
        <NumericKeypad
          onKey={(k) => {
            const target = step === 'pin' ? pin : pinConfirm;
            const setTarget = step === 'pin' ? setPin : setPinConfirm;
            if (k === 'del') setTarget(target.slice(0, -1));
            else if (k === 'ok') {
              if (step === 'pin') {
                if (pin.length < 4) return;
                setStep('confirm');
              } else {
                if (pin !== pinConfirm) { alert('No coinciden'); setPin(''); setPinConfirm(''); setStep('pin'); return; }
                onSave(pin);
              }
            } else if (target.length < 6) setTarget(target + k);
          }}
        />
      </div>
    </Modal>
  );
}
