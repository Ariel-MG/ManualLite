import { numberSteps, type NumberableStep, type NumberingOptions } from './numbering';

export type TocEntry =
  | { kind: 'section'; caption: string; label: string }
  | { kind: 'action'; actionNo: number; caption: string; label: string };

export type TocStep = NumberableStep;

export type TocOptions = NumberingOptions;

/**
 * Índice persistente (HTML, PDF y Markdown).
 * Con secciones: solo esas secciones ya etiquetadas.
 * Sin secciones: acciones como "Paso N. caption", igual que hoy.
 */
export function buildTocEntries(steps: TocStep[], opts: TocOptions = {}): TocEntry[] {
  const { hierarchical, at } = numberSteps(steps, opts);
  const entries: TocEntry[] = [];
  for (const heading of at) {
    if (!heading) continue;
    if (hierarchical) {
      if (heading.kind === 'section') {
        entries.push({ kind: 'section', caption: heading.caption, label: heading.label });
      }
      continue;
    }
    if (heading.kind === 'action') {
      entries.push({
        kind: 'action',
        actionNo: heading.actionNo ?? 0,
        caption: heading.caption,
        label: heading.label,
      });
    }
  }
  return entries;
}

export function tocLine(entry: TocEntry): string {
  return entry.label;
}
