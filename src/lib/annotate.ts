import type { ClickPoint } from '../types';

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

  // Radio relativo al tamaño de la imagen, con límites razonables.
  const radius = Math.max(16, Math.min(width, height) * 0.025);
  const { x, y } = clickOnImage;

  // Halo semitransparente
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
  ctx.fill();

  // Anillo hueco (solo contorno) para no tapar el elemento clickeado.
  // Borde blanco exterior para contraste sobre fondos oscuros.
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(5, radius * 0.28);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(3, radius * 0.18);
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { blob, width, height };
}
