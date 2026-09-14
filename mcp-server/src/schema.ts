// Espejo ligero del formato de archivo `.manuallite.json`.
//
// FUENTE DE LA VERDAD: `src/lib/project.ts` de la extensión (interface ProjectFile).
// Este servidor MCP es un paquete separado y NO debe importar código de la extensión
// (que asume APIs de navegador como `fetch`/`FileReader`), así que duplicamos el esquema.
// Si en la extensión cambia `FORMAT_VERSION` o la forma del archivo, actualizar aquí.

import { z } from 'zod';

export const FORMAT = 'ManualLite';

const ClickPoint = z.object({ x: z.number(), y: z.number() });

const SerializedVariant = z.object({
  label: z.string(),
  description: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  screenshot: z.string().optional(), // dataURL
  annotated: z.string().optional(), // dataURL
});

const SerializedStep = z.object({
  kind: z.enum(['action', 'section', 'note', 'rule']).optional(),
  caption: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  click: ClickPoint.optional(),
  clickOnImage: ClickPoint.optional(),
  element: z
    .object({
      tag: z.string(),
      text: z.string().optional(),
      role: z.string().optional(),
    })
    .optional(),
  screenshot: z.string().optional(), // dataURL (solo acciones)
  annotated: z.string().optional(), // dataURL
  variants: z.array(SerializedVariant).optional(),
});

const ManualMeta = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  accentColor: z.string().optional(),
  author: z.string().optional(),
  version: z.string().optional(),
  company: z.string().optional(),
  confidentiality: z.string().optional(),
  pageSize: z.enum(['A4', 'LETTER']).optional(),
  createdAt: z.number(),
  logo: z.string().optional(), // dataURL
});

export const ProjectFileSchema = z.object({
  app: z.literal(FORMAT),
  formatVersion: z.number(),
  exportedAt: z.number(),
  manual: ManualMeta,
  steps: z.array(SerializedStep),
});

export type ProjectFile = z.infer<typeof ProjectFileSchema>;
export type SerializedStep = z.infer<typeof SerializedStep>;
