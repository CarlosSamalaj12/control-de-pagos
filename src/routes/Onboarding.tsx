// src/routes/Onboarding.tsx
// Crea el perfil único (single-profile por device) + opcionalmente
// las personas que compartirán suscripciones.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Wallet, Plus, X, UserPlus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input, Field } from '../components/ui/Input';
import { PinInput, NumericKeypad } from '../components/ui/PinInput';
import { createFirstProfile, createPerson, getCurrentPersonId } from '../hooks/useProfile';
import { setSalary } from '../hooks/useFinanzas';
import { useSessionStore } from '../stores/useSessionStore';
import { useUIStore } from '../stores/useUIStore';
import { setSession } from '../lib/auth/session';
import { seedDemoData } from '../db/seed.sql';
import { MONEDA_PRINCIPAL } from '../types';

const COLORS = ['#1F4E78', '#2E75B6', '#70AD47', '#C2185B', '#E67E22', '#8E44AD', '#16A085', '#34495E'];
const PERSON_COLORS = ['#C2185B', '#2E75B6', '#70AD47', '#E67E22', '#8E44AD', '#16A085', '#F4B084', '#5B9BD5'];

type Step = 'welcome' | 'profile' | 'pin' | 'people' | 'salary' | 'demo' | 'done';

interface PersonDraft {
  id: string;
  nombre: string;
  color: string;
}

export function Onboarding() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const [step, setStep] = useState<Step>('welcome');

  // Profile
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');

  // People drafts (roommates)
  const [people, setPeople] = useState<PersonDraft[]>([]);
  const [newPersonNombre, setNewPersonNombre] = useState('');
  const [newPersonColor, setNewPersonColor] = useState(PERSON_COLORS[0]);

  // Salary
  const [salaryAmount, setSalaryAmount] = useState('');
  const [seedDemo, setSeedDemo] = useState(false);

  // Resultado
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);

  const onPinKey = (k: string) => {
    const target = pinStep === 'enter' ? pin : pinConfirm;
    const setTarget = pinStep === 'enter' ? setPin : setPinConfirm;
    if (k === 'del') setTarget(target.slice(0, -1));
    else if (k === 'ok') handlePinOk();
    else if (target.length < 6) setTarget(target + k);
  };

  const handlePinOk = async () => {
    if (pinStep === 'enter') {
      if (pin.length < 4) {
        showToast('PIN mínimo 4 dígitos', 'error');
        return;
      }
      setPinStep('confirm');
    } else {
      if (pin !== pinConfirm) {
        showToast('Los PINs no coinciden', 'error');
        setPin('');
        setPinConfirm('');
        setPinStep('enter');
        return;
      }
      try {
        const { profile, personId } = await createFirstProfile({
          nombre: nombre.trim(),
          color,
          pin,
        });
        setCreatedProfileId(profile.id);
        // Crear las personas (roommates) que el usuario agregó
        for (const p of people) {
          await createPerson({ nombre: p.nombre, color: p.color });
        }
        setStep('salary');
        // Guardar el personId para usarlo luego
        sessionStorage.setItem('onboarding:selfPersonId', personId);
      } catch (e: any) {
        showToast(e.message, 'error');
      }
    }
  };

  const addPerson = () => {
    if (!newPersonNombre.trim()) return;
    setPeople((cur) => [
      ...cur,
      { id: crypto.randomUUID(), nombre: newPersonNombre.trim(), color: newPersonColor },
    ]);
    setNewPersonNombre('');
    // siguiente color
    const idx = PERSON_COLORS.indexOf(newPersonColor);
    setNewPersonColor(PERSON_COLORS[(idx + 1) % PERSON_COLORS.length]);
  };

  const removePerson = (id: string) => {
    setPeople((cur) => cur.filter((p) => p.id !== id));
  };

  const handleSaveSalary = async () => {
    const selfPersonId = sessionStorage.getItem('onboarding:selfPersonId');
    if (!selfPersonId) {
      setStep('demo');
      return;
    }
    // Para finanzas personales necesitamos el profile.id (no el person.id)
    // Como las finanzas son por profile, usamos el profile_id del profile actual
    if (salaryAmount && !Number.isNaN(parseFloat(salaryAmount))) {
      const db = (await import('../db/client')).getDb();
      const profileId = db.selectValue('SELECT id FROM profiles ORDER BY created_at LIMIT 1') as string;
      if (profileId) {
        const now = new Date();
        await setSalary({
          profileId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          amount: parseFloat(salaryAmount),
          currency: MONEDA_PRINCIPAL,
        });
      }
    }
    setStep('demo');
  };

  const handleDemo = async (load: boolean) => {
    if (load) {
      try {
        await seedDemoData();
        showToast('Datos de muestra cargados', 'success');
      } catch (e: any) {
        showToast(e.message, 'error');
      }
    }
    if (createdProfileId) {
      setSession(createdProfileId, 24);
      useSessionStore.setState({ currentProfileId: createdProfileId });
    }
    sessionStorage.removeItem('onboarding:selfPersonId');
    navigate('/', { replace: true });
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-brand-primary to-brand-accent text-white">
        <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center mb-6">
          <Wallet size={48} />
        </div>
        <h1 className="text-3xl font-bold mb-2">Control de Pagos</h1>
        <p className="text-white/80 text-center mb-8 max-w-xs">
          Gestioná suscripciones compartidas y tus finanzas personales, todo en tu celular, sin servidores.
        </p>
        <Button size="lg" fullWidth variant="secondary" onClick={() => setStep('profile')}>
          Empezar <ChevronRight size={18} />
        </Button>
      </div>
    );
  }

  if (step === 'profile') {
    return (
      <div className="min-h-screen p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-1">Tu nombre</h2>
        <p className="text-slate-500 mb-6">Esto te identifica en la app y aparece en tickets.</p>
        <div className="space-y-4">
          <Field label="Nombre">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Carlos"
              autoFocus
            />
          </Field>
          <Field label="Color">
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full transition ${color === c ? 'ring-4 ring-offset-2 ring-brand-primary/40' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </Field>
          <Button fullWidth size="lg" onClick={() => setStep('pin')} disabled={nombre.trim().length < 2}>
            Siguiente <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'pin') {
    return (
      <div className="min-h-screen p-6 max-w-md mx-auto flex flex-col">
        <h2 className="text-2xl font-bold mb-1">
          {pinStep === 'enter' ? 'Elegí un PIN' : 'Confirmá el PIN'}
        </h2>
        <p className="text-slate-500 mb-8">4 a 6 dígitos. Protege tu app.</p>
        <PinInput length={6} value={pinStep === 'enter' ? pin : pinConfirm} onChange={() => {}} />
        <div className="mt-8">
          <NumericKeypad onKey={onPinKey} />
        </div>
        <Button variant="ghost" fullWidth className="mt-4" onClick={() => { setStep('profile'); setPin(''); setPinConfirm(''); setPinStep('enter'); }}>
          Volver
        </Button>
      </div>
    );
  }

  if (step === 'people') {
    return (
      <div className="min-h-screen p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-1">¿Con quién compartís?</h2>
        <p className="text-slate-500 mb-6">
          Agregá las personas con las que vas a compartir suscripciones (roommates, familia, etc.).
          No necesitan tener la app.
        </p>

        <Card>
          {people.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">
              Todavía no agregaste a nadie. Podés hacerlo más tarde.
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: p.color }}>
                    {p.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium">{p.nombre}</span>
                  <button onClick={() => removePerson(p.id)} className="p-1 text-slate-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 space-y-2">
            <Field label="Nombre">
              <Input
                value={newPersonNombre}
                onChange={(e) => setNewPersonNombre(e.target.value)}
                placeholder="Ej. María"
                onKeyDown={(e) => { if (e.key === 'Enter') addPerson(); }}
              />
            </Field>
            <Field label="Color">
              <div className="flex gap-2 flex-wrap">
                {PERSON_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewPersonColor(c)}
                    className={`w-8 h-8 rounded-full transition ${newPersonColor === c ? 'ring-4 ring-offset-2 ring-brand-primary/40' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </Field>
            <Button size="sm" variant="secondary" fullWidth onClick={addPerson} disabled={!newPersonNombre.trim()}>
              <Plus size={16} /> Agregar persona
            </Button>
          </div>
        </Card>

        <div className="flex gap-2 mt-6">
          <Button variant="secondary" fullWidth onClick={() => setStep('salary')}>
            {people.length === 0 ? 'Omitir' : 'Siguiente'}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'salary') {
    return (
      <div className="min-h-screen p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-1">¿Cuánto ganás por mes?</h2>
        <p className="text-slate-500 mb-6">Opcional — podés cambiarlo después.</p>
        <Field label={`Sueldo mensual (${MONEDA_PRINCIPAL})`}>
          <Input
            type="number"
            inputMode="decimal"
            value={salaryAmount}
            onChange={(e) => setSalaryAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </Field>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" fullWidth onClick={() => setStep('demo')}>
            Omitir
          </Button>
          <Button fullWidth onClick={handleSaveSalary}>
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'demo') {
    return (
      <div className="min-h-screen p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-1">¿Querés datos de muestra?</h2>
        <p className="text-slate-500 mb-6">3 personas de ejemplo y 5 suscripciones (Netflix, Spotify, etc.) para probar la app.</p>
        <div className="space-y-3">
          <Button fullWidth size="lg" onClick={() => handleDemo(true)}>
            Sí, cargar
          </Button>
          <Button variant="secondary" fullWidth onClick={() => handleDemo(false)}>
            No, empezar limpio
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// Helper inline
import { Card } from '../components/ui/Card';
