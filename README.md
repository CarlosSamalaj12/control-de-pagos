# Control de Pagos y Finanzas — PWA

Aplicación móvil (PWA) para llevar el control de suscripciones compartidas y finanzas personales. **100% local** (SQLite embebido vía WASM, datos en OPFS), **sin servidor, sin cuentas, sin cloud**.

## ✨ Features

- **🔐 Multi-perfil con PIN**: cada persona del grupo (vos + 2-3 roommates) tiene su propio perfil protegido con PIN de 4-6 dígitos (hasheado con PBKDF2).
- **💳 Suscripciones compartidas**: alta, ciclos automáticos (incluye ciclos atrasados si elegís una fecha de inicio pasada), dividir entre N participantes, registrar pagos — también con fecha pasada para pagos atrasados.
- **📄 Estado de cuenta PDF**: ticket formal con folio, fechas de vencimiento, cuota/pagado/pendiente y totales (vencido + por vencer) por persona, listo para mandar por WhatsApp o imprimir.
- **💰 Finanzas personales**: sueldo mensual, gastos categorizados, presupuesto por categoría con alertas, metas de ahorro con aportes.
- **📊 Dashboard unificado**: en una sola vista ves suscripciones del mes + sueldo/gastos + gráficos + metas.
- **🔔 Notificaciones locales**: avisos de vencimientos (donde el browser lo soporte).
- **💾 Backup**: export/import JSON y export del archivo `.sqlite3` completo.
- **🌗 Modo oscuro** y responsive mobile-first.

## 🛠️ Stack técnico

- **React 19** + **TypeScript 6** + **Vite 8**
- **SQLite WASM oficial** (`@sqlite.org/sqlite-wasm`) con persistencia en **OPFS** (fallback a IndexedDB).
- **Capa reactiva custom** (`useQuery(sql, params)`) — sin librerías de estado extra.
- **Tailwind CSS 3** + **shadcn-style** components propios.
- **Zustand** para estado UI efímero.
- **jsPDF** + **jspdf-autotable** para el ticket PDF.
- **recharts** para el gráfico de torta de categorías.
- **vite-plugin-pwa** + Workbox para service worker y manifest.
- **lucide-react** para iconos.
- **date-fns** para fechas.
- **react-hook-form** + **zod** para validación.

## 🚀 Setup local

```bash
npm install --legacy-peer-deps
npm run dev
```

Abrí `http://localhost:5173` en Chrome/Edge/Firefox/Safari 17+ recientes.

## 🏗️ Build de producción

```bash
npm run build
```

Salida en `dist/` con:
- `index.html`
- `assets/` con JS, CSS, WASM de SQLite, fuentes, etc.
- `sw.js` + `workbox-*.js` (service worker)
- `manifest.webmanifest`

## 🌐 Deploy

El build es estático. Configurá estos headers críticos en tu hosting (Vercel, Netlify, Cloudflare Pages, S3+CloudFront, etc.):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

> Sin estos headers, el WASM de SQLite no se carga y la app no funciona.

### Vercel

`vercel.json` ya incluido. Solo `vercel --prod` o conectá el repo.

### Netlify

Creá `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

## 📱 Instalar como PWA

En **Chrome/Edge Android**: la app muestra automáticamente un banner "Agregar a pantalla de inicio".
En **iOS Safari**: Safari → Compartir → Agregar a pantalla de inicio.

Una vez instalada, se abre en modo standalone (sin barra del browser) y funciona 100% offline.

## 🔐 Privacidad

- Los datos viven en un archivo SQLite dentro de **OPFS** (Origin Private File System), que es privado del origen y no se comparte con otras webs.
- Los PINs se hashean con **PBKDF2 (SHA-256, 100k iter, salt random)**. No se guardan en claro.
- No hay tracking, cookies, fingerprinting, ni nada que se envíe a un servidor.
- El backup JSON **excluye los pin_hash** por seguridad.

## 🧪 Compatibilidad de browsers

| Feature | Soporte |
|---|---|
| OPFS | Chrome 102+, Edge 102+, Firefox 111+, Safari 17+ |
| SQLite WASM | Universal en browsers modernos |
| Web Notifications | Chrome/Edge/Firefox/Safari (con limitations en iOS) |
| Service Worker | Universal |
| Install prompt | Chrome/Edge/Safari (con UI distinta en cada uno) |

En iOS < 17 la app funciona pero usa el fallback a IndexedDB (un poco más lento).

## 📁 Estructura del proyecto

```
src/
├── db/                # SQLite WASM client, schema, capa reactiva
├── lib/               # Lógica de dominio (ciclo generator, balances, PDF, etc.)
├── hooks/             # Hooks de datos (useProfile, useSuscripciones, etc.)
├── stores/            # Zustand stores (sesión, config, UI)
├── components/        # UI primitives + componentes de dominio
├── routes/            # Páginas (Login, Onboarding, Home tabs, etc.)
├── styles/            # Tailwind + tokens
└── types/             # Tipos TypeScript compartidos
```

## 🗺️ Roadmap (v2+)

- Sincronización cloud / multi-device.
- Magic link / OAuth.
- WebAuthn / biometría.
- Conversión de monedas.
- Notificaciones push.
- Versión nativa con Capacitor.

---

Hecho con 🛠️ y ☕.
