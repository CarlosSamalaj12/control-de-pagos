// src/routes/people/People.tsx
// Gestión de personas: vos mismo (is_self=1) + roommates/terceros (is_self=0).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, User, Star } from 'lucide-react';
import { usePeople, createPerson, updatePerson, deletePerson, useCurrentProfile } from '../../hooks/useProfile';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { useUIStore } from '../../stores/useUIStore';
import { useSessionStore } from '../../stores/useSessionStore';

const COLORS = ['#1F4E78', '#2E75B6', '#70AD47', '#C2185B', '#E67E22', '#8E44AD', '#16A085', '#34495E', '#F4B084', '#5B9BD5'];

export function People() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const logout = useSessionStore((s) => s.logout);
  const { profile } = useCurrentProfile();
  const { people } = usePeople();

  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const self = people.find((p: any) => p.is_self);
  const others = people.filter((p: any) => !p.is_self);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Personas</h2>
      </div>

      <p className="text-sm text-slate-500">
        Las personas que aparecen en tus suscripciones compartidas. No necesitan tener la app.
      </p>

      {/* Yo */}
      {self && (
        <Card>
          <div className="flex items-center gap-3">
            <ProfileAvatar nombre={self.nombre} iniciales={self.iniciales} color={self.color} size="md" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2">
                {self.nombre}
                <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star size={10} /> vos
                </span>
              </div>
              <div className="text-xs text-slate-500">Tú</div>
            </div>
            {profile && (
              <button
                onClick={() => {
                  if (confirm('¿Cerrar sesión?')) logout();
                }}
                className="p-2 text-slate-400 hover:text-brand-primary"
                title="Cerrar sesión"
              >
                <User size={16} />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Roommates / terceros */}
      {others.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Con quienes compartís</div>
          {others.map((p: any) => (
            <Card key={p.id}>
              <div className="flex items-center gap-3">
                <ProfileAvatar nombre={p.nombre} iniciales={p.iniciales} color={p.color} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{p.nombre}</div>
                  {p.contacto && <div className="text-xs text-slate-500 truncate">{p.contacto}</div>}
                </div>
                <button onClick={() => setEditId(p.id)} className="p-2 text-slate-500 hover:text-brand-primary">
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`¿Eliminar a "${p.nombre}"? Esto la quita de todas las suscripciones donde participe.`)) return;
                    try {
                      await deletePerson(p.id);
                      showToast('Persona eliminada', 'success');
                    } catch (e: any) {
                      showToast(e.message, 'error');
                    }
                  }}
                  className="p-2 text-slate-500 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button fullWidth onClick={() => setNewOpen(true)}>
        <Plus size={18} /> Agregar persona
      </Button>

      <PersonFormModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSave={async (data) => {
          await createPerson(data);
          showToast('Persona agregada', 'success');
          setNewOpen(false);
        }}
      />

      {editId && (() => {
        const p = people.find((x: any) => x.id === editId);
        if (!p) return null;
        return (
          <PersonFormModal
            open
            initial={p}
            onClose={() => setEditId(null)}
            onSave={async (data) => {
              await updatePerson(p.id, data);
              showToast('Persona actualizada', 'success');
              setEditId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function PersonFormModal({ open, onClose, onSave, initial }: any) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [contacto, setContacto] = useState(initial?.contacto ?? '');

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar persona' : 'Nueva persona'}>
      <div className="space-y-3">
        <Field label="Nombre">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. María" autoFocus />
        </Field>
        <Field label="Contacto (opcional)">
          <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="WhatsApp, email, etc." />
        </Field>
        <Field label="Color">
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
        <Button fullWidth onClick={() => onSave({ nombre: nombre.trim(), color, contacto: contacto.trim() || undefined })} disabled={!nombre.trim()}>
          {initial ? 'Guardar' : 'Agregar'}
        </Button>
      </div>
    </Modal>
  );
}
