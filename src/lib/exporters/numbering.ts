/**
 * Contrato único de numeración para PDF, HTML, Markdown e índice.
 * Se deriva al exportar desde el array plano; no se persiste en el JSON.
 */

export interface NumberableStep {
  kind?: 'action' | 'section' | 'note' | 'rule';
  caption?: string;
  screenshot?: unknown;
  annotated?: unknown;
  width?: number;
  height?: number;
}

export interface NumberingOptions {
  /** El PDF descarta acciones sin width/height; HTML/Markdown no. */
  requireSize?: boolean;
}

export interface NumberedHeading {
  kind: 'section' | 'action';
  /**
   * Jerárquico: `1.` / `1.1.`.
   * Plano: `Paso 1` (sin punto; el PDF del modo plano lo dibuja así).
   * Huérfana (story 1.1): cadena vacía — ni `0.1.` ni `Paso N`.
   */
  token: string;
  caption: string;
  /** Etiqueta completa: `1. Título` / `1.1. Título` / `Paso 1. Título`. */
  label: string;
  /** Número de acción: global en plano, M dentro de la sección en jerárquico. */
  actionNo?: number;
  sectionNo?: number;
}

export interface Numbering {
  hierarchical: boolean;
  /** Paralelo a `steps`; `undefined` si el paso no lleva etiqueta (nota, regla, sin imagen). */
  at: Array<NumberedHeading | undefined>;
}

function isNumerableAction(step: NumberableStep, requireSize?: boolean): boolean {
  if (step.kind === 'section' || step.kind === 'note' || step.kind === 'rule') return false;
  const img = step.annotated ?? step.screenshot;
  if (!img) return false;
  if (requireSize && (!step.width || !step.height)) return false;
  return true;
}

/**
 * Recorre el array plano y asigna etiquetas de sección/acción.
 * Presencia de al menos un `kind: section` decide el modo.
 */
export function numberSteps(steps: NumberableStep[], opts: NumberingOptions = {}): Numbering {
  const hierarchical = steps.some((s) => s.kind === 'section');
  const at: Array<NumberedHeading | undefined> = Array.from({ length: steps.length });

  if (!hierarchical) {
    let actionNo = 0;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!isNumerableAction(step, opts.requireSize)) continue;
      actionNo += 1;
      const caption = step.caption ?? '';
      at[i] = {
        kind: 'action',
        token: `Paso ${actionNo}`,
        caption,
        label: `Paso ${actionNo}. ${caption}`,
        actionNo,
      };
    }
    return { hierarchical: false, at };
  }

  let sectionNo = 0;
  let actionInSection = 0;
  let inSection = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.kind === 'section') {
      inSection = true;
      sectionNo += 1;
      actionInSection = 0;
      const caption = step.caption || 'Sección';
      at[i] = {
        kind: 'section',
        token: `${sectionNo}.`,
        caption,
        label: `${sectionNo}. ${caption}`,
        sectionNo,
      };
      continue;
    }
    if (step.kind === 'note' || step.kind === 'rule') continue;
    if (!isNumerableAction(step, opts.requireSize)) continue;

    const caption = step.caption ?? '';
    if (!inSection) {
      at[i] = {
        kind: 'action',
        token: '',
        caption,
        label: caption,
      };
      continue;
    }

    actionInSection += 1;
    at[i] = {
      kind: 'action',
      token: `${sectionNo}.${actionInSection}.`,
      caption,
      label: `${sectionNo}.${actionInSection}. ${caption}`,
      actionNo: actionInSection,
      sectionNo,
    };
  }

  return { hierarchical: true, at };
}
