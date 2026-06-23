// Genera iconos PNG cuadrados de color sólido (placeholder) sin dependencias.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const len = data.length;
  const out = new Uint8Array(12 + len);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, len);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcInput = out.slice(4, 8 + len);
  dv.setUint32(8 + len, crc32(crcInput));
  return out;
}

function makePng(size: number, rgb: [number, number, number]): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  // resto en 0 (compresión/filtro/entrelazado por defecto)

  const stride = size * 3 + 1;
  const raw = new Uint8Array(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtro None
    for (let x = 0; x < size; x++) {
      const o = y * stride + 1 + x * 3;
      raw[o] = rgb[0];
      raw[o + 1] = rgb[1];
      raw[o + 2] = rgb[2];
    }
  }
  const idat = deflateSync(raw);

  const chunks = [
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(idat)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    png.set(c, off);
    off += c.length;
  }
  return png;
}

const RED: [number, number, number] = [220, 38, 38];
for (const size of [16, 48, 128]) {
  const path = resolve(import.meta.dirname, '..', 'public', 'icons', `icon${size}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, makePng(size, RED));
  console.log('escrito', path);
}
