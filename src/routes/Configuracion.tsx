// src/routes/Configuracion.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Wallet } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Field } from '../components/ui/Input';
import { useConfigStore } from '../stores/useConfigStore';
import { useUIStore } from '../stores/useUIStore';
import { requestPermission } from '../lib/notifications';
import { useCurrentProfile, usePerson } from '../hooks/useProfile';
import { CuentasPagoCard } from '../components/cuentas/CuentasPagoCard';

export function Configuracion() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const notificaciones = useConfigStore((s) => s.notificaciones);
  const setNotificaciones = useConfigStore((s) => s.setNotificaciones);
  const diasAnticipacion = useConfigStore((s) => s.diasAnticipacion);
  const setDiasAnticipacion = useConfigStore((s) => s.setDiasAnticipacion);
  const [dias, setDias] = useState(String(diasAnticipacion));

  // Emisor (people con is_self=1) — se pasa al card de cuentas.
  const { profile } = useCurrentProfile();
  const { person: emisorSelf } = usePerson(profile?.personId ?? null);

  const handleToggleNotif = async () => {
    if (!notificaciones) {
      const r = await requestPermission();
      if (r !== 'granted') {
        showToast('Permiso denegado', 'error');
        return;
      }
    }
    setNotificaciones(!notificaciones);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Configuración</h2>
      </div>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 flex items-center gap-2">
          <Bell size={14} className="text-slate-500" />
          Notificaciones
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-slate-500" />
              <div>
                <div className="font-medium text-sm">Activar avisos</div>
                <div className="text-xs text-slate-500">Vencimientos y presupuestos</div>
              </div>
            </div>
            <button
              onClick={handleToggleNotif}
              className={`w-12 h-7 rounded-full transition ${notificaciones ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition transform ${notificaciones ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <Field label="Días de anticipación">
            <Input type="number" value={dias} onChange={(e) => setDias(e.target.value)} onBlur={() => setDiasAnticipacion(parseInt(dias, 10) || 3)} className="!w-24" />
          </Field>
        </div>
      </Card>

      <CuentasPagoCard peopleId={emisorSelf?.id ?? null} />
    </div>
  );
}
