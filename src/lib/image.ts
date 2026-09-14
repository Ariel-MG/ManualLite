import { blobToDataURL } from './blob';

export type ImageQuality = 'png' | 'high' | 'medium' | 'low';

const JPEG_QUALITY: Record<Exclude<ImageQuality, 'png'>, number> = {
  high: 0.92,
  medium: 0.78,
  low: 0.55,
};

export const QUALITY_LABELS: Record<ImageQuality, string> = {
  png: 'PNG (sin pérdida)',
  high: 'JPEG alta',
  medium: 'JPEG media',
  low: 'JPEG baja',
};

/** Extensión de archivo según la calidad elegida. */
export function imageExt(quality: ImageQuality): 'png' | 'jpg' {
  return quality === 'png' ? 'png' : 'jpg';
}

/** Recodifica un blob a JPEG con la calidad dada (o lo deja igual si es PNG). */
export async function reencode(blob: Blob, quality: ImageQuality): Promise<Blob> {
  if (quality === 'png') return blob;
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d')!;
  // JPEG no tiene alfa: pintamos fondo blanco antes.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', JPEG_QUALITY[quality]),
  );
}

export async function exportImageDataUrl(blob: Blob, quality: ImageQuality): Promise<string> {
  return blobToDataURL(await reencode(blob, quality));
}

/**
 * Decodifica una imagen subida por el usuario y la normaliza a PNG (sin
 * pérdida), devolviendo también sus dimensiones reales en px.
 */
export async function fileToPngImage(
  file: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const width = bmp.width;
  const height = bmp.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  );
  return { blob, width, height };
}
