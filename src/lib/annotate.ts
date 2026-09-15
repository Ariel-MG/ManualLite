import type { ClickPoint } from '../types';
import { paintClickRing } from './clickRing';

export interface AnnotateResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Dibuja un marcador (anillo hueco + halo) sobre la captura, en las
 * coordenadas del click. Es hueco a propósito: sin número (que se
 * desincronizaría al borrar pasos) y dejando ver el elemento clickeado.
 * Usa OffscreenCanvas para poder correr dentro del service worker
 * (MV3 no tiene `document`).
 */
export async function annotateScreenshot(
  source: Blob,
  clickOnImage: ClickPoint,
): Promise<AnnotateResult> {
  const bitmap = await createImageBitmap(source);
  const { width, height } = bitmap;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D');

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  paintClickRing(
    ctx as unknown as CanvasRenderingContext2D,
    clickOnImage.x,
    clickOnImage.y,
    width,
    height,
  );

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { blob, width, height };
}
