// src/lib/notifications.ts
// Notificaciones locales via Web Notifications API.
import { getProximosVencimientos } from './balanceCompartido';
import { formatCurrency } from './format';

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied' as NotificationPermission;
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (!canNotify()) return;
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', ...options });
      });
    } else {
      new Notification(title, { icon: '/icons/icon-192.png', ...options });
    }
  } catch (e) {
    console.warn('[notifications] showNotification falló:', e);
  }
}

export function checkVencimientos() {
  const proximos = getProximosVencimientos(3, 5);
  for (const v of proximos) {
    const diffMs = v.fechaVencimiento - Date.now();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 1) {
      showNotification(`Vence ${v.nombre}`, {
        body: `Mañana se vence. Cobrado: ${formatCurrency(v.cobrado as any)} / ${formatCurrency(v.costoTotal as any)}`,
        tag: `venc-${v.cicloId}`,
      });
    } else {
      showNotification(`Próximo: ${v.nombre}`, {
        body: `Vence en ${diffDays} días.`,
        tag: `venc-${v.cicloId}`,
      });
    }
  }
}
