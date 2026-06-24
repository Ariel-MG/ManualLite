import type { Manual, Step } from '../types';
import { addStep, createManual, getSteps, updateManual } from '../db';
import { blobToDataURL, downloadBlob, safeName } from './blob';

const FORMAT = 'ManualLite';
const FORMAT_VERSION = 1;

interface SerializedStep {
  kind?: Step['kind'];
  caption: string;
  description?: string;
  url?: string;
  width?: number;
  height?: number;
  click?: Step['click'];
  clickOnImage?: Step['clickOnImage'];
  element?: Step['element'];
  screenshot?: string; // dataURL (solo acciones)
  annotated?: string; // dataURL
}

interface ProjectFile {
  app: typeof FORMAT;
  formatVersion: number;
  exportedAt: number;
  manual: {
    title: string;
    subtitle?: string;
    accentColor?: string;
    author?: string;
    version?: string;
    company?: string;
    confidentiality?: string;
    pageSize?: Manual['pageSize'];
    createdAt: number;
    logo?: string; // dataURL
  };
  steps: SerializedStep[];
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Exporta un manual completo (con imágenes) a un archivo .json descargable. */
export async function exportProject(manual: Manual, steps: Step[]): Promise<void> {
  const project: ProjectFile = {
    app: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: Date.now(),
    manual: {
      title: manual.title,
      subtitle: manual.subtitle,
      accentColor: manual.accentColor,
      author: manual.author,
      version: manual.version,
      company: manual.company,
      confidentiality: manual.confidentiality,
      pageSize: manual.pageSize,
      createdAt: manual.createdAt,
      logo: manual.logo ? await blobToDataURL(manual.logo) : undefined,
    },
    steps: await Promise.all(
      steps.map(async (s) => ({
        kind: s.kind,
        caption: s.caption,
        description: s.description,
        url: s.url,
        width: s.width,
        height: s.height,
        click: s.click,
        clickOnImage: s.clickOnImage,
        element: s.element,
        screenshot: s.screenshot ? await blobToDataURL(s.screenshot) : undefined,
        annotated: s.annotated ? await blobToDataURL(s.annotated) : undefined,
      })),
    ),
  };

  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  downloadBlob(blob, `${safeName(manual.title)}.manuallite.json`);
}

/** Importa un archivo .json y recrea el manual con nuevos ids. Devuelve el id. */
export async function importProject(file: File): Promise<string> {
  const parsed = JSON.parse(await file.text()) as ProjectFile;
  if (parsed.app !== FORMAT || !Array.isArray(parsed.steps)) {
    throw new Error('El archivo no es un proyecto válido de ManualLite.');
  }

  const manual = await createManual(parsed.manual.title || 'Manual importado');
  await updateManual(manual.id, {
    subtitle: parsed.manual.subtitle,
    accentColor: parsed.manual.accentColor,
    author: parsed.manual.author,
    version: parsed.manual.version,
    company: parsed.manual.company,
    confidentiality: parsed.manual.confidentiality,
    pageSize: parsed.manual.pageSize,
    logo: parsed.manual.logo ? await dataUrlToBlob(parsed.manual.logo) : undefined,
  });

  for (const s of parsed.steps) {
    await addStep({
      manualId: manual.id,
      kind: s.kind ?? 'action',
      screenshot: s.screenshot ? await dataUrlToBlob(s.screenshot) : undefined,
      annotated: s.annotated ? await dataUrlToBlob(s.annotated) : undefined,
      width: s.width,
      height: s.height,
      click: s.click,
      clickOnImage: s.clickOnImage,
      element: s.element,
      caption: s.caption,
      description: s.description,
      url: s.url,
    });
  }

  return manual.id;
}

/** Atajo: exporta por id (carga los pasos desde la BD). */
export async function exportProjectById(manual: Manual): Promise<void> {
  await exportProject(manual, await getSteps(manual.id));
}
