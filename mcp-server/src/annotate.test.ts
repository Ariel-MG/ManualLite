import { describe, expect, it } from 'bun:test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { annotateScreenshot } from './annotate.js';

const WIDTH = 120;
const HEIGHT = 80;
const CLICK = { x: 60, y: 40 };

function expectedRadius(width: number, height: number): number {
  return Math.max(16, Math.min(width, height) * 0.025);
}

async function solidPng(width: number, height: number, color: string): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.encode('png');
}

async function sample(
  png: Buffer,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number; a: number }> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return { r: data[0]!, g: data[1]!, b: data[2]!, a: data[3]! };
}

describe('annotateScreenshot', () => {
  it('pinta halo, stroke blanco y anillo #dc2626 sobre el click', async () => {
    const png = await solidPng(WIDTH, HEIGHT, '#000000');
    const annotated = await annotateScreenshot(png, CLICK);

    expect(annotated.subarray(0, 8).toString('binary')).toBe('\x89PNG\r\n\x1a\n');
    expect(annotated.equals(png)).toBe(false);

    const radius = expectedRadius(WIDTH, HEIGHT);
    expect(radius).toBe(16);

    const ring = await sample(annotated, CLICK.x + radius, CLICK.y);
    // Línea central ≈ #dc2626 (220, 38, 38); antialias Skia, no byte-igual.
    expect(ring.r).toBeGreaterThan(200);
    expect(ring.g).toBeLessThan(70);
    expect(ring.b).toBeLessThan(70);
    expect(Math.abs(ring.g - 38)).toBeLessThan(30);
    expect(Math.abs(ring.b - 38)).toBeLessThan(30);

    // El blanco (lineWidth mayor) se ve en el borde: G/B suben respecto al rojo puro.
    const whiteEdge = await sample(annotated, CLICK.x + radius + 1, CLICK.y);
    expect(whiteEdge.g).toBeGreaterThan(ring.g + 40);
    expect(whiteEdge.b).toBeGreaterThan(ring.b + 40);

    const halo = await sample(annotated, CLICK.x + radius * 1.5, CLICK.y);
    expect(halo.r).toBeGreaterThan(halo.g);
    expect(halo.r).toBeGreaterThan(halo.b);
    expect(halo.r).toBeLessThan(ring.r);
    expect(halo.g).toBeLessThan(40);
    expect(halo.b).toBeLessThan(40);
  });

  it('pinta el anillo en un click fuera del centro con radio distinto de 16', async () => {
    const width = 800;
    const height = 800;
    const click = { x: 200, y: 150 };
    const png = await solidPng(width, height, '#000000');
    const annotated = await annotateScreenshot(png, click);
    const radius = expectedRadius(width, height);

    expect(radius).toBe(20);
    const ring = await sample(annotated, click.x + radius, click.y);
    expect(ring.r).toBeGreaterThan(200);
    expect(Math.abs(ring.g - 38)).toBeLessThan(30);
    expect(Math.abs(ring.b - 38)).toBeLessThan(30);
  });

  it('rechaza bytes que no son imagen y no produce PNG anotado', async () => {
    const invalid = Buffer.from('esto no es una imagen');

    await expect(annotateScreenshot(invalid, CLICK)).rejects.toThrow();
  });

  it('rechaza coordenadas de click no finitas', async () => {
    const png = await solidPng(WIDTH, HEIGHT, '#000000');

    await expect(annotateScreenshot(png, { x: Number.NaN, y: 40 })).rejects.toThrow();
    await expect(annotateScreenshot(png, { x: 60, y: Number.POSITIVE_INFINITY })).rejects.toThrow();
  });
});
