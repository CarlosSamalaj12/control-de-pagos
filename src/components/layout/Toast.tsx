// src/components/layout/Toast.tsx
import { useUIStore } from '../../stores/useUIStore';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  if (!toast) return null;
  const Icon = toast.type === 'error' ? AlertCircle : toast.type === 'info' ? Info : CheckCircle2;
  const color =
    toast.type === 'error'
      ? 'bg-red-600'
      : toast.type === 'info'
      ? 'bg-slate-800'
      : 'bg-brand-primary';
  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div className={`${color} text-white px-4 py-3 rounded-xl shadow-soft-lg flex items-center gap-2 max-w-sm`}>
        <Icon size={20} />
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
