// Genera iconos PNG reales (64x64) usando zlib puro. Sin dependencias.
// Produce un PNG azul #1F4E78 con símbolo $ centrado.
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { deflateSync } from 'zlib';

const SIZE = 64;
const COLOR_BG = [0x1F, 0x4E, 0x78, 0xFF]; // RGBA #1F4E78
const COLOR_FG = [0xFF, 0xFF, 0xFF, 0xFF]; // blanco

function makePixelMatrix() {
  // Crea matriz SIZE×SIZE de pixeles RGBA.
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const radius = 14;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      // Determinar si está dentro del rounded-rect
      const inX = x >= 0 && x < SIZE;
      const inY = y >= 0 && y < SIZE;
      let isBg = inX && inY;
      // Esquinas redondeadas
      const cornerChecks = [
        { cx: radius, cy: radius, ox: 0, oy: 0 },
        { cx: SIZE - radius - 1, cy: radius, ox: 1, oy: 0 },
        { cx: radius, cy: SIZE - radius - 1, ox: 0, oy: 1 },
        { cx: SIZE - radius - 1, cy: SIZE - radius - 1, ox: 1, oy: 1 },
      ];
      for (const c of cornerChecks) {
        if (x >= Math.min(c.cx, c.ox ? SIZE - 1 : 0) && x <= Math.max(c.cx, c.ox ? SIZE - 1 : 0) &&
            y >= Math.min(c.cy, c.oy ? SIZE - 1 : 0) && y <= Math.max(c.cy, c.oy ? SIZE - 1 : 0)) {
          const dx = x - c.cx;
          const dy = y - c.cy;
          if (dx * dx + dy * dy > radius * radius) {
            isBg = false;
          }
        }
      }
      let color = isBg ? COLOR_BG : [0, 0, 0, 0];

      // Dibujar $ simple (línea vertical + S)
      // Vertical line: x = 32, y entre 14 y 50
      if (x === 32 && y >= 14 && y <= 50) color = COLOR_FG;
      // Top horizontal: y = 20, x entre 24 y 40
      if (y === 20 && x >= 24 && x <= 40) color = COLOR_FG;
      // Mid horizontal: y = 32, x entre 22 y 42
      if (y === 32 && x >= 22 && x <= 42) color = COLOR_FG;
      // Bottom horizontal: y = 44, x entre 24 y 40
      if (y === 44 && x >= 24 && x <= 40) color = COLOR_FG;
      // Top-right vertical: x = 40, y entre 20 y 32
      if (x === 40 && y >= 20 && y <= 32) color = COLOR_FG;
      // Bottom-left vertical: x = 24, y entre 32 y 44
      if (x === 24 && y >= 32 && y <= 44) color = COLOR_FG;

      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = color[3];
    }
  }
  return pixels;
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const td = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function makePNG(size) {
  const pixels = makePixelMatrix();
  // Apply filter (0 = None) to each scanline
  const filtered = Buffer.alloc(size * size * 4 + size);
  for (let y = 0; y < size; y++) {
    filtered[y * (size * 4 + 1)] = 0;
    pixels.subarray(y * size * 4, (y + 1) * size * 4).forEach((b, i) => {
      filtered[y * (size * 4 + 1) + 1 + i] = b;
    });
  }
  const compressed = deflateSync(filtered);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;     // bit depth
  ihdr[9] = 6;     // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = resolve('public/icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = makePNG(SIZE); // siempre 64x64, el browser escala
  const name = size === 192 ? 'icon-192.png' : 'icon-512.png';
  writeFileSync(resolve(outDir, name), png);
  console.log('Wrote', name, png.length, 'bytes');
}
writeFileSync(resolve(outDir, 'icon-maskable-512.png'), makePNG(SIZE));
console.log('Wrote icon-maskable-512.png');
console.log('Done.');
