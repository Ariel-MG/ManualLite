// Carga/guardado de archivos `.manuallite.json` y helpers de imagen.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ProjectFileSchema, type ProjectFile } from './schema.js';

const SUFFIX = '.manuallite.json';

/** Lee y valida un archivo de proyecto. Lanza si no es un ManualLite válido. */
export async function loadProject(filePath: string): Promise<ProjectFile> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`No se pudo leer el archivo: ${filePath}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`El archivo no es JSON válido: ${filePath}`);
  }
  const parsed = ProjectFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `El archivo no es un proyecto válido de ManualLite: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}

/** Escribe un proyecto a disco (JSON compacto, como el export de la extensión). */
export async function saveProject(filePath: string, project: ProjectFile): Promise<void> {
  await writeFile(filePath, JSON.stringify(project), 'utf8');
}

export interface ManualSummary {
  path: string;
  title: string;
  stepCount: number;
}

/** Lista los archivos `*.manuallite.json` de un directorio con un resumen breve. */
export async function listManuals(dir: string): Promise<ManualSummary[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: ManualSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(SUFFIX)) continue;
    const full = path.join(dir, entry.name);
    try {
      const project = await loadProject(full);
      out.push({ path: full, title: project.manual.title, stepCount: project.steps.length });
    } catch {
      // Ignora archivos con sufijo pero formato inválido.
    }
  }
  return out;
}

/** Ruta de salida por defecto: `<nombre>.revisado.manuallite.json` junto al original. */
export function defaultRevisedPath(sourcePath: string): string {
  const dir = path.dirname(sourcePath);
  const base = path.basename(sourcePath);
  const stem = base.endsWith(SUFFIX) ? base.slice(0, -SUFFIX.length) : base.replace(/\.json$/, '');
  return path.join(dir, `${stem}.revisado${SUFFIX}`);
}

export interface DecodedImage {
  data: string; // base64 sin el prefijo dataURL
  mimeType: string;
}

/** Separa un dataURL (`data:image/png;base64,...`) en mimeType + base64 puro. */
export function decodeDataUrl(dataUrl: string): DecodedImage {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('La imagen no es un dataURL válido.');
  const [, mimeType, isBase64, payload] = match;
  if (!isBase64) {
    // dataURL sin base64 (poco común para imágenes): re-codificar.
    return { mimeType, data: Buffer.from(decodeURIComponent(payload), 'utf8').toString('base64') };
  }
  return { mimeType, data: payload };
}
