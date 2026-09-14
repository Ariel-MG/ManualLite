export type TocEntry =
  | { kind: 'section'; caption: string }
  | { kind: 'action'; actionNo: number; caption: string };

export interface TocStep {
  kind?: 'action' | 'section' | 'note' | 'rule';
  caption: string;
  screenshot?: unknown;
  annotated?: unknown;
  width?: number;
  height?: number;
}

export interface TocOptions {
  /** El PDF descarta acciones sin width/height; HTML/Markdown no. */
  requireSize?: boolean;
}

/**
 * Índice persistente (HTML, PDF y Markdown): secciones en negrita y
 * acciones como "Paso N. caption", en el mismo orden del cuerpo.
 */
export function buildTocEntries(steps: TocStep[], opts: TocOptions = {}): TocEntry[] {
  const entries: TocEntry[] = [];
  let actionNo = 0;
  for (const step of steps) {
    if (step.kind === 'section') {
      entries.push({ kind: 'section', caption: step.caption || 'Sección' });
      continue;
    }
    if (step.kind === 'note' || step.kind === 'rule') continue;
    const img = step.annotated ?? step.screenshot;
    if (!img) continue;
    if (opts.requireSize && (!step.width || !step.height)) continue;
    actionNo += 1;
    entries.push({ kind: 'action', actionNo, caption: step.caption });
  }
  return entries;
}

export function tocLine(entry: TocEntry): string {
  return entry.kind === 'section' ? entry.caption : `Paso ${entry.actionNo}. ${entry.caption}`;
}
