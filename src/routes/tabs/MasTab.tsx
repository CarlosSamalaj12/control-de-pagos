// src/routes/tabs/MasTab.tsx
import { useNavigate } from 'react-router-dom';
import { Users, Settings, Download, Upload, Trash2, Bell, Sun, Moon, Smartphone, Info, Receipt } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useConfigStore } from '../../stores/useConfigStore';
import { useUIStore } from '../../stores/useUIStore';
import { downloadBackup, importBackup } from '../../lib/backup';
import { wipeAllData } from '../../db/client';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';

export function MasTab() {
  const navigate = useNavigate();
  const tema = useConfigStore((s) => s.tema);
  const setTema = useConfigStore((s) => s.setTema);
  const showToast = useUIStore((s) => s.showToast);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importBackup(data, 'replace');
      showToast('Backup importado. Recargá la app.', 'success');
      setImportOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Más</h2>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">General</div>
        <div className="space-y-1">
          <MenuItem icon={Receipt} label="Deudas" onClick={() => navigate('/deudas')} />
          <MenuItem icon={Users} label="Personas" onClick={() => navigate('/people')} />
          <MenuItem icon={Bell} label="Notificaciones" onClick={() => navigate('/configuracion')} />
          <MenuItem icon={Settings} label="Configuración" onClick={() => navigate('/configuracion')} />
        </div>
      </Card>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Apariencia</div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant={tema === 'light' ? 'primary' : 'secondary'} size="sm" onClick={() => setTema('light')}>
            <Sun size={16} /> Claro
          </Button>
          <Button variant={tema === 'dark' ? 'primary' : 'secondary'} size="sm" onClick={() => setTema('dark')}>
            <Moon size={16} /> Oscuro
          </Button>
          <Button variant={tema === 'system' ? 'primary' : 'secondary'} size="sm" onClick={() => setTema('system')}>
            <Smartphone size={16} /> Auto
          </Button>
        </div>
      </Card>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Datos</div>
        <div className="space-y-2">
          <Button fullWidth variant="secondary" onClick={downloadBackup}>
            <Download size={18} /> Exportar backup (JSON)
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload size={18} /> Importar backup
          </Button>
          <Button fullWidth variant="danger" onClick={() => setWipeOpen(true)}>
            <Trash2 size={18} /> Borrar todo
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Info size={16} />
          <div>
            <div className="font-semibold">Control de Pagos v0.1</div>
            <div className="text-xs">Datos 100% locales en tu dispositivo.</div>
          </div>
        </div>
      </Card>

      <Modal open={wipeOpen} onClose={() => setWipeOpen(false)} title="¿Borrar todo?">
        <p className="text-sm text-slate-600 mb-4">
          Se eliminarán todos los perfiles, personas, suscripciones, gastos y metas. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setWipeOpen(false)}>Cancelar</Button>
          <Button variant="danger" fullWidth onClick={async () => {
            await wipeAllData();
            showToast('Todo borrado', 'success');
            setWipeOpen(false);
            setTimeout(() => window.location.reload(), 1000);
          }}>Borrar</Button>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar backup">
        <p className="text-sm text-slate-600 mb-4">
          Seleccioná un archivo JSON. Esto <strong>reemplazará</strong> todos los datos actuales.
        </p>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
          }}
          className="block w-full text-sm"
        />
      </Modal>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.98] transition text-left"
    >
      <Icon size={18} className="text-slate-500" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-slate-400">→</span>
    </button>
  );
}
