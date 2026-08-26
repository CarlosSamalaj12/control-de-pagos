// src/lib/pdf/iconToPng.ts
// Renderiza un ícono lucide-react a un PNG data URL usando la API de
// Canvas del navegador. El resultado se puede pasar a `doc.addImage()`
// de jsPDF. Si el ícono no existe en ICON_MAP o falla el render, se
// devuelve null (el caller hace fallback a texto o cuadrado sin ícono).
import type { LucideIcon } from 'lucide-react';
import {
  Tv,
  Music,
  Cloud,
  Sparkles,
  Play,
  Wifi,
  Smartphone,
  Gamepad2,
  Film,
  Video,
  Camera,
  Monitor,
  Book,
  Briefcase,
  DollarSign,
  Home,
  Car,
  Coffee,
  Mail,
  Bell,
  Shield,
  Lock,
  Zap,
  Package,
  Star,
  Heart,
  Box,
  Globe,
  Headphones,
  Newspaper,
  Music2,
  Radio,
  Cast,
  type Icon as IconType,
} from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Mapa de nombre de ícono (string guardado en BD) → componente lucide.
 * El set cubre los íconos del seed (tv, music, cloud, sparkles, play)
 * más un set razonable de íconos genéricos útiles para suscripciones.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  // Seed
  tv: Tv,
  music: Music,
  cloud: Cloud,
  sparkles: Sparkles,
  play: Play,
  // Comunes para suscripciones
  wifi: Wifi,
  smartphone: Smartphone,
  gamepad: Gamepad2,
  film: Film,
  video: Video,
  camera: Camera,
  monitor: Monitor,
  book: Book,
  briefcase: Briefcase,
  dollar: DollarSign,
  home: Home,
  car: Car,
  coffee: Coffee,
  mail: Mail,
  bell: Bell,
  shield: Shield,
  lock: Lock,
  zap: Zap,
  package: Package,
  // Extras
  star: Star,
  heart: Heart,
  box: Box,
  globe: Globe,
  headphones: Headphones,
  newspaper: Newspaper,
  music2: Music2,
  radio: Radio,
  cast: Cast,
};

/** Íconos disponibles para el picker del form (mismo set, exportado para JSX). */
export interface IconOption {
  key: string;
  label: string;
  Icon: LucideIcon;
}

import {
  Tv as _Tv,
  Music as _Music,
  Cloud as _Cloud,
  Sparkles as _Sparkles,
  Play as _Play,
  Wifi as _Wifi,
  Smartphone as _Smartphone,
  Gamepad2 as _Gamepad2,
  Film as _Film,
  Video as _Video,
  Camera as _Camera,
  Monitor as _Monitor,
  Book as _Book,
  Briefcase as _Briefcase,
  DollarSign as _DollarSign,
  Home as _Home,
  Car as _Car,
  Coffee as _Coffee,
  Mail as _Mail,
  Bell as _Bell,
  Shield as _Shield,
  Lock as _Lock,
  Zap as _Zap,
  Package as _Package,
  Star as _Star,
  Heart as _Heart,
  Box as _Box,
  Globe as _Globe,
  Headphones as _Headphones,
  Newspaper as _Newspaper,
  Music2 as _Music2,
  Radio as _Radio,
  Cast as _Cast,
} from 'lucide-react';

export const ICON_OPTIONS: IconOption[] = [
  { key: 'tv', label: 'TV / Video', Icon: _Tv },
  { key: 'music', label: 'Música', Icon: _Music },
  { key: 'cloud', label: 'Nube / Almacenamiento', Icon: _Cloud },
  { key: 'sparkles', label: 'IA / Premium', Icon: _Sparkles },
  { key: 'play', label: 'Reproducir', Icon: _Play },
  { key: 'wifi', label: 'Internet / WiFi', Icon: _Wifi },
  { key: 'smartphone', label: 'Celular', Icon: _Smartphone },
  { key: 'gamepad', label: 'Gaming', Icon: _Gamepad2 },
  { key: 'film', label: 'Películas', Icon: _Film },
  { key: 'video', label: 'Video', Icon: _Video },
  { key: 'camera', label: 'Cámara', Icon: _Camera },
  { key: 'monitor', label: 'Monitor / PC', Icon: _Monitor },
  { key: 'book', label: 'Libro / Lectura', Icon: _Book },
  { key: 'briefcase', label: 'Trabajo', Icon: _Briefcase },
  { key: 'dollar', label: 'Dinero', Icon: _DollarSign },
  { key: 'home', label: 'Hogar', Icon: _Home },
  { key: 'car', label: 'Auto / Transporte', Icon: _Car },
  { key: 'coffee', label: 'Café / Comida', Icon: _Coffee },
  { key: 'mail', label: 'Email', Icon: _Mail },
  { key: 'bell', label: 'Notificaciones', Icon: _Bell },
  { key: 'shield', label: 'Seguridad', Icon: _Shield },
  { key: 'lock', label: 'Privacidad', Icon: _Lock },
  { key: 'zap', label: 'Energía / Velocidad', Icon: _Zap },
  { key: 'package', label: 'Paquete', Icon: _Package },
  { key: 'star', label: 'Favorito', Icon: _Star },
  { key: 'heart', label: 'Salud / Bienestar', Icon: _Heart },
  { key: 'box', label: 'Caja / Producto', Icon: _Box },
  { key: 'globe', label: 'Web / Internet', Icon: _Globe },
  { key: 'headphones', label: 'Audio', Icon: _Headphones },
  { key: 'newspaper', label: 'Noticias / Prensa', Icon: _Newspaper },
  { key: 'music2', label: 'Música (alt)', Icon: _Music2 },
  { key: 'radio', label: 'Radio', Icon: _Radio },
  { key: 'cast', label: 'Streaming', Icon: _Cast },
];

function buildSvgString(Icon: LucideIcon, size: number, color = '#ffffff'): string {
  // Lucide usa currentColor por default; forzamos blanco (foreground).
  // Construimos el SVG manualmente para tener control sobre el color
  // y el tamaño. Usamos createElement en vez de JSX para que este
  // archivo pueda quedar como .ts.
  const inner = renderToStaticMarkup(createElement(Icon, { size, color }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/**
 * Renderiza un ícono lucide en un cuadrado con el color de fondo
 * indicado y devuelve un data URL PNG. Si el ícono no existe en
 * ICON_MAP, devuelve null.
 */
export async function iconToPng(
  iconName: string | undefined | null,
  bgColor: string,
  size: number = 32
): Promise<string | null> {
  if (!iconName) return null;
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  if (typeof document === 'undefined') return null; // no DOM = no canvas

  const svgString = buildSvgString(Icon, size, '#ffffff');
  const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Multiplicamos por 3 para mejor resolución al imprimir.
        const scale = 3;
        canvas.width = size * scale;
        canvas.height = size * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.scale(scale, scale);
        // Fondo redondeado con el color de la suscripción
        ctx.fillStyle = bgColor;
        const radius = size * 0.18;
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(0, 0, size, size, radius);
          ctx.fill();
        } else {
          // Fallback para navegadores sin roundRect
          ctx.beginPath();
          ctx.moveTo(radius, 0);
          ctx.arcTo(size, 0, size, size, radius);
          ctx.arcTo(size, size, 0, size, radius);
          ctx.arcTo(0, size, 0, 0, radius);
          ctx.arcTo(0, 0, size, 0, radius);
          ctx.closePath();
          ctx.fill();
        }
        // Dibujar el ícono blanco centrado (con padding interno)
        const padding = size * 0.22;
        ctx.drawImage(
          img,
          padding,
          padding,
          size - padding * 2,
          size - padding * 2
        );
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[iconToPng] failed to render icon:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svgDataUrl;
  });
}
