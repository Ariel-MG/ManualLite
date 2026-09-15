// Backend de anillo del MCP: contexto 2D con @napi-rs/canvas y geometría de paintClickRing.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { paintClickRing } from '../../src/lib/clickRing.js';

export interface ClickOnImage {
  x: number;
  y: number;
}

/**
 * Pinta el anillo de click sobre un PNG y devuelve otro PNG.
 * No polyfillea APIs de browser: loadImage + createCanvas + encode.
 */
export async function annotateScreenshot(
  png: Buffer,
  clickOnImage: ClickOnImage,
): Promise<Buffer> {
  const image = await loadImage(png);
  const { width, height } = image;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);
  const { x, y } = clickOnImage;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('Las coordenadas del click no son finitas.');
  }
  paintClickRing(ctx as unknown as CanvasRenderingContext2D, x, y, width, height);

  return canvas.encode('png');
}
