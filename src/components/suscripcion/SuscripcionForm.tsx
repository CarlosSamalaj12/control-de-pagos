// src/components/suscripcion/SuscripcionForm.tsx
// Form compartido para alta y edición de suscripciones.
// Reutilizado por NuevaSuscripcion y EditarSuscripcion.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Field } from '../ui/Input';
import { DatePicker } from '../ui/DatePicker';
import { usePeople, createPerson } from '../../hooks/useProfile';
import { createSuscripcion, updateSuscripcion } from '../../hooks/useSuscripciones';
import { generarCiclosFuturos } from '../../lib/cicloGenerator';
import { useUIStore } from '../../stores/useUIStore';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { inputDateToTimestamp } from '../../lib/format';
import { ICON_OPTIONS } from '../../lib/pdf/iconToPng';
import type { Moneda, Periodicidad, Suscripcion, SuscripcionParticipante } from '../../types';
import { MONEDA_PRINCIPAL } from '../../types';

const COLORS = ['#1F4E78', '#E50914', '#1DB954', '#0070C9', '#10A37F', '#FF0000', '#FF8800', '#9B59B6'];
const PERSON_COLORS = ['#C2185B', '#2E75B6', '#70AD47', '#E67E22', '#8E44AD', '#16A085', '#F4B084', '#5B9BD5'];

export interface SuscripcionFormInitial {
  id?: string;
  nombre: string;
  costoTotal: number;
  moneda: Moneda;
  periodicidad: Periodicidad;
  diaVencimiento?: number;
  intervaloDias?: number;
  color: string;
  icono?: string;
  payerPeopleId: string;
  fechaInicio?: number;
  participantes: Array<{ peopleId: string; cuotaEsperada: number }>;
  notas?: string;
}

export interface SuscripcionFormProps {
  mode: 'create' | 'edit';
  initial?: SuscripcionFormInitial;
  /** Si se pasa, el form regenera los ciclos hacia adelante (default true en create, false en edit). */
  regenerateCycles?: boolean;
  onSaved?: () => void;
  /** Si true, oculta el header "← Volver / Título" (útil cuando el form está embebido en otra vista). */
  embedded?: boolean;
}

export function SuscripcionForm({ mode, initial, regenerateCycles, onSaved, embedded }: SuscripcionFormProps) {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const { people } = usePeople();

  // Estado del form
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [costo, setCosto] = useState(String(initial?.costoTotal ?? ''));
  const [moneda, setMoneda] = useState<Moneda>(initial?.moneda ?? MONEDA_PRINCIPAL);
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(initial?.periodicidad ?? 'mensual');
  const [dia, setDia] = useState(
    String(initial?.diaVencimiento ?? initial?.intervaloDias ?? '7')
  );
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [icono, setIcono] = useState(initial?.icono ?? 'tv');
  const [participants, setParticipants] = useState<string[]>(
    initial?.participantes.map((p) => p.peopleId) ?? []
  );
  const [payerId, setPayerId] = useState<string | null>(initial?.payerPeopleId ?? null);
  const [cuotasCustom, setCuotasCustom] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    initial?.participantes.forEach((p) => {
      if (p.cuotaEsperada) out[p.peopleId] = String(p.cuotaEsperada);
    });
    return out;
  });
  // Fecha desde cuándo se genera el seguimiento. Default = hoy.
  // Si el usuario ya tiene deuda de meses anteriores, puede elegir la fecha
  // de inicio del primer ciclo.
  const today = new Date();
  const defaultFechaInicio = initial?.fechaInicio
    ? new Date(initial.fechaInicio)
    : today;
  const [fechaInicio, setFechaInicio] = useState(() => {
    return `${defaultFechaInicio.getFullYear()}-${String(defaultFechaInicio.getMonth() + 1).padStart(2, '0')}-${String(defaultFechaInicio.getDate()).padStart(2, '0')}`;
  });

  // Inline person creation
  const [newPersonNombre, setNewPersonNombre] = useState('');
  const [newPersonColor, setNewPersonColor] = useState(PERSON_COLORS[0]);
  const [showAddPerson, setShowAddPerson] = useState(false);

  // Si en edit mode no hay payer preseleccionado, usar el "vos" (is_self=1)
  useEffect(() => {
    if (!payerId && people.length > 0) {
      const self = people.find((p: any) => p.is_self);
      if (self) setPayerId(self.id);
    }
  }, [people, payerId]);

  const self = people.find((p: any) => p.is_self);
  const others = people.filter((p: any) => !p.is_self);

  const total = parseFloat(costo) || 0;
  const activeParts = participants.length;
  const cuotaDefault = activeParts > 0 ? total / activeParts : 0;

  const toggle = (id: string) => {
    setParticipants((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      // Si el payer sale de los participantes, limpiar
      if (!next.includes(payerId || '')) setPayerId(null);
      return next;
    });
  };

  const handleAddPerson = async () => {
    if (!newPersonNombre.trim()) return;
    try {
      const id = await createPerson({ nombre: newPersonNombre.trim(), color: newPersonColor });
      setParticipants((cur) => [...cur, id]);
      setNewPersonNombre('');
      const idx = PERSON_COLORS.indexOf(newPersonColor);
      setNewPersonColor(PERSON_COLORS[(idx + 1) % PERSON_COLORS.length]);
      setShowAddPerson(false);
      showToast('Persona agregada', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const onSave = async () => {
    if (!nombre.trim() || total <= 0 || activeParts === 0 || !payerId) {
      showToast('Completá nombre, costo, payer y al menos un participante', 'error');
      return;
    }
    try {
      const participantes = participants.map((id) => ({
        peopleId: id,
        cuotaEsperada: parseFloat(cuotasCustom[id]) || +(total / activeParts).toFixed(2),
      }));
      const baseData = {
        nombre: nombre.trim(),
        costoTotal: total,
        moneda,
        periodicidad,
        diaVencimiento: periodicidad === 'cada_n_dias' ? undefined : parseInt(dia, 10) || 1,
        intervaloDias: periodicidad === 'cada_n_dias' ? parseInt(dia, 10) || 30 : undefined,
        color,
        icono,
        payerPeopleId: payerId,
        fechaInicio: inputDateToTimestamp(fechaInicio),
        participantes,
      };

      if (mode === 'create') {
        await createSuscripcion(baseData);
        showToast('Suscripción creada', 'success');
      } else if (initial?.id) {
        await updateSuscripcion(initial.id, baseData);
        // Si se adelantó la fecha de inicio (o se pidió explícito), generar
        // los ciclos atrasados que falten. No duplica: salta períodos ya creados.
        const shouldRegenerate =
          regenerateCycles === true || baseData.fechaInicio < (initial.fechaInicio ?? Infinity);
        if (shouldRegenerate) {
          try {
            generarCiclosFuturos(initial.id, 12);
          } catch (e) {
            console.warn('[SuscripcionForm] generarCiclosFuturos falló:', e);
          }
        }
        showToast('Suscripción actualizada', 'success');
      }
      onSaved?.();
      navigate('/');
    } catch (e: any) {
      console.error('[SuscripcionForm] error al guardar:', e);
      const msg = e?.message ?? (typeof e === 'string' ? e : 'Error desconocido');
      showToast(`Error: ${msg}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">
            {mode === 'create' ? 'Nueva suscripción' : 'Editar suscripción'}
          </h2>
        </div>
      )}

      <Card>
        <div className="space-y-3">
          <Field label="Nombre">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Netflix, Spotify..."
              autoFocus
            />
          </Field>
          <Field label="Costo total">
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="0.00"
              />
              <select
                className="input !w-24"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as Moneda)}
              >
                <option value="GTQ">GTQ</option>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </Field>
          <Field label="Periodicidad">
            <select
              className="input"
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)}
            >
              <option value="mensual">Mensual</option>
              <option value="semanal">Semanal</option>
              <option value="cada_n_dias">Cada N días</option>
            </select>
          </Field>
          <Field
            label={
              periodicidad === 'semanal'
                ? 'Día de la semana (0=Dom)'
                : periodicidad === 'cada_n_dias'
                ? 'Cada cuántos días'
                : 'Día del mes (1-28)'
            }
          >
            <Input type="number" value={dia} onChange={(e) => setDia(e.target.value)} />
          </Field>
          <Field
            label="Fecha de inicio (cuotas que ya te deben)"
            hint="Si te deben meses anteriores, elegí la fecha del primer mes adeudado: los ciclos atrasados se generan solos y suman al pendiente de cada persona."
          >
            <DatePicker
              value={fechaInicio}
              onChange={setFechaInicio}
            />
          </Field>
          <Field label="Color del servicio">
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full ${color === c ? 'ring-4 ring-offset-2 ring-brand-primary/40' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
          <Field
            label="Ícono"
            hint="Se muestra al lado del servicio en la app y en el PDF del estado de cuenta."
          >
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {ICON_OPTIONS.map(({ key, label, Icon }) => {
                const selected = icono === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcono(key)}
                    title={label}
                    aria-label={label}
                    className={`aspect-square rounded-xl flex items-center justify-center transition ${
                      selected
                        ? 'ring-4 ring-offset-2 ring-brand-primary/40 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    style={selected ? { backgroundColor: color } : undefined}
                  >
                    <Icon size={20} />
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
          ¿Quién paga? ({activeParts} participan)
        </div>
        <div className="space-y-2">
          {people.length === 0 && (
            <div className="text-sm text-slate-400 text-center py-2">No hay personas todavía</div>
          )}
          {people.map((p: any) => {
            const isIn = participants.includes(p.id);
            const isPayer = payerId === p.id;
            return (
              <div key={p.id} className="flex items-center gap-2">
                <button
                  onClick={() => isIn && setPayerId(p.id)}
                  disabled={!isIn}
                  className={`flex items-center gap-3 flex-1 p-2 rounded-xl transition ${
                    isPayer
                      ? 'bg-brand-primary text-white ring-2 ring-brand-primary'
                      : isIn
                      ? 'bg-slate-50 dark:bg-slate-800/50'
                      : 'opacity-50'
                  }`}
                >
                  <ProfileAvatar
                    nombre={p.nombre}
                    iniciales={p.iniciales}
                    color={isPayer ? '#fff' : p.color}
                    size="md"
                  />
                  <span className="font-medium text-sm flex-1 text-left">
                    {p.nombre}
                    {p.is_self ? ' (yo)' : ''}
                  </span>
                </button>
                <button
                  onClick={() => toggle(p.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                    isIn
                      ? 'bg-brand-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isIn ? 'Sacar' : 'Sumar'}
                </button>
                {isIn && (
                  <Input
                    type="number"
                    value={cuotasCustom[p.id] ?? ''}
                    onChange={(e) =>
                      setCuotasCustom({ ...cuotasCustom, [p.id]: e.target.value })
                    }
                    placeholder={cuotaDefault.toFixed(2)}
                    className="!w-24 !py-2 !text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          {!showAddPerson ? (
            <Button size="sm" variant="ghost" fullWidth onClick={() => setShowAddPerson(true)}>
              <Plus size={14} /> Agregar persona
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newPersonNombre}
                  onChange={(e) => setNewPersonNombre(e.target.value)}
                  placeholder="Nombre"
                  autoFocus
                />
                <Button size="sm" onClick={handleAddPerson} disabled={!newPersonNombre.trim()}>
                  OK
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddPerson(false);
                    setNewPersonNombre('');
                  }}
                >
                  <X size={14} />
                </Button>
              </div>
              <div className="flex gap-1.5">
                {PERSON_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewPersonColor(c)}
                    className={`w-6 h-6 rounded-full ${
                      newPersonColor === c ? 'ring-2 ring-offset-1 ring-brand-primary' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {activeParts > 0 && total > 0 && (
        <Card>
          <div className="text-sm text-slate-500">Cuota por persona (default)</div>
          <div className="text-2xl font-bold">
            {cuotaDefault.toFixed(2)} {moneda}
          </div>
        </Card>
      )}

      <Button fullWidth size="lg" onClick={onSave}>
        {mode === 'create' ? 'Crear suscripción' : 'Guardar cambios'}
      </Button>
    </div>
  );
}
