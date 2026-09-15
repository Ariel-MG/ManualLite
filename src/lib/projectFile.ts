import type { Manual, Step } from '../types';

export const FORMAT = 'ManualLite';
export const FORMAT_VERSION = 1;

export interface SerializedVariant {
  label: string;
  description?: string;
  width?: number;
  height?: number;
  screenshot?: string; // dataURL
  annotated?: string; // dataURL
}

export interface SerializedStep {
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
  variants?: SerializedVariant[];
}

export interface ProjectFile {
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

/** Parsea un `.manuallite.json`. Devuelve el objeto parseado sin reconstruir campo a campo. */
export function parseProjectFile(text: string): ProjectFile {
  const parsed = JSON.parse(text) as ProjectFile;
  if (parsed.app !== FORMAT || !Array.isArray(parsed.steps)) {
    throw new Error('El archivo no es un proyecto válido de ManualLite.');
  }
  return parsed;
}

/** Serializa un ProjectFile. No inventa campos ausentes. */
export function serializeProjectFile(project: ProjectFile): string {
  return JSON.stringify(project);
}
