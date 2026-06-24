// Definición de las herramientas MCP para revisar manuales de ManualLite.

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  decodeDataUrl,
  defaultRevisedPath,
  listManuals,
  loadProject,
  saveProject,
} from './manual.js';

/** Texto JSON envuelto como contenido de texto MCP. */
function jsonText(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function errorText(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function registerTools(server: McpServer): void {
  server.tool(
    'list_manuals',
    'Lista los archivos *.manuallite.json de un directorio (p. ej. la carpeta de Descargas), ' +
      'con título y número de pasos de cada uno.',
    { dir: z.string().describe('Ruta absoluta del directorio donde buscar manuales exportados.') },
    async ({ dir }) => {
      try {
        const manuals = await listManuals(dir);
        return jsonText({ count: manuals.length, manuals });
      } catch (err) {
        return errorText(`No se pudo listar el directorio: ${(err as Error).message}`);
      }
    },
  );

  server.tool(
    'load_manual',
    'Carga un manual y devuelve un resumen de texto para revisión (metadatos de portada + ' +
      'pasos con index, kind, caption, description, url y un flag hasImage). Omite el base64 ' +
      'de las imágenes. Úsalo para revisar pasos, escritura y ortografía.',
    { path: z.string().describe('Ruta absoluta al archivo .manuallite.json.') },
    async ({ path: filePath }) => {
      try {
        const project = await loadProject(filePath);
        const summary = {
          path: filePath,
          formatVersion: project.formatVersion,
          manual: {
            title: project.manual.title,
            subtitle: project.manual.subtitle,
            author: project.manual.author,
            version: project.manual.version,
            company: project.manual.company,
            confidentiality: project.manual.confidentiality,
            pageSize: project.manual.pageSize,
          },
          stepCount: project.steps.length,
          steps: project.steps.map((s, index) => ({
            index,
            kind: s.kind ?? 'action',
            caption: s.caption,
            description: s.description,
            url: s.url,
            hasImage: Boolean(s.annotated || s.screenshot),
          })),
        };
        return jsonText(summary);
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.tool(
    'get_step_image',
    'Devuelve la imagen de un paso como contenido de imagen para que puedas verla y sugerir ' +
      'un caption/description. Por defecto usa la imagen anotada (con el marcador del click).',
    {
      path: z.string().describe('Ruta absoluta al archivo .manuallite.json.'),
      stepIndex: z.number().int().nonnegative().describe('Índice del paso (0-based) según load_manual.'),
      which: z
        .enum(['annotated', 'screenshot'])
        .optional()
        .describe('Cuál imagen devolver. Por defecto "annotated".'),
    },
    async ({ path: filePath, stepIndex, which }) => {
      try {
        const project = await loadProject(filePath);
        const step = project.steps[stepIndex];
        if (!step) return errorText(`No existe el paso con índice ${stepIndex}.`);
        const preferred = which ?? 'annotated';
        const dataUrl =
          (preferred === 'annotated' ? step.annotated : step.screenshot) ??
          step.annotated ??
          step.screenshot;
        if (!dataUrl) return errorText(`El paso ${stepIndex} no tiene imagen.`);
        const { data, mimeType } = decodeDataUrl(dataUrl);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Paso ${stepIndex} — caption actual: ${JSON.stringify(step.caption)}`,
            },
            { type: 'image' as const, data, mimeType },
          ],
        };
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );

  server.tool(
    'write_corrected_manual',
    'Aplica correcciones de texto (caption/description) por índice de paso y escribe un NUEVO ' +
      'archivo .manuallite.json reimportable en la extensión. Conserva intactas las imágenes y ' +
      'demás campos. Por defecto escribe <nombre>.revisado.manuallite.json junto al original.',
    {
      sourcePath: z.string().describe('Ruta absoluta del manual original a corregir.'),
      corrections: z
        .array(
          z.object({
            index: z.number().int().nonnegative().describe('Índice del paso (0-based).'),
            caption: z.string().optional().describe('Nuevo caption (omitir para no cambiarlo).'),
            description: z
              .string()
              .optional()
              .describe('Nueva description (omitir para no cambiarla).'),
          }),
        )
        .describe('Lista de correcciones de texto a aplicar.'),
      outputPath: z
        .string()
        .optional()
        .describe('Ruta de salida explícita. Si se omite, usa <nombre>.revisado.manuallite.json.'),
    },
    async ({ sourcePath, corrections, outputPath }) => {
      try {
        const project = await loadProject(sourcePath);
        const applied: number[] = [];
        const skipped: number[] = [];
        for (const c of corrections) {
          const step = project.steps[c.index];
          if (!step) {
            skipped.push(c.index);
            continue;
          }
          if (c.caption !== undefined) step.caption = c.caption;
          if (c.description !== undefined) step.description = c.description;
          applied.push(c.index);
        }
        const target = outputPath ?? defaultRevisedPath(sourcePath);
        await saveProject(target, project);
        return jsonText({
          outputPath: target,
          appliedSteps: applied,
          skippedSteps: skipped,
          message: `Archivo corregido escrito. Reimpórtalo en la extensión para aplicar los cambios.`,
        });
      } catch (err) {
        return errorText((err as Error).message);
      }
    },
  );
}
