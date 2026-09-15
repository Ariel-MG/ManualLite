import { describe, expect, it } from 'vitest';
import { numberSteps, type NumberableStep } from './numbering';
import { buildTocEntries, tocLine } from './toc';

function section(caption: string): NumberableStep {
  return { kind: 'section', caption };
}

function action(
  caption: string,
  opts: { img?: boolean; width?: number; height?: number } = {},
): NumberableStep {
  const hasImg = opts.img !== false;
  return {
    kind: 'action',
    caption,
    screenshot: hasImg ? 'img' : undefined,
    width: opts.width,
    height: opts.height,
  };
}

function note(caption = 'Nota'): NumberableStep {
  return { kind: 'note', caption, screenshot: undefined };
}

function rule(caption = 'Regla'): NumberableStep {
  return { kind: 'rule', caption, screenshot: undefined };
}

function labels(steps: NumberableStep[], opts?: { requireSize?: boolean }): Array<string | undefined> {
  return numberSteps(steps, opts).at.map((h) => h?.label);
}

const THREE_SECTIONS: NumberableStep[] = [
  section('Alfa'),
  action('A1'),
  action('A2'),
  section('Beta'),
  action('B1'),
  section('Gamma'),
  action('C1'),
  action('C2'),
];

describe('numberSteps — jerárquico', () => {
  it('numera ≥3 secciones y sus acciones como N. / N.M. con punto, sin Paso', () => {
    expect(labels(THREE_SECTIONS)).toEqual([
      '1. Alfa',
      '1.1. A1',
      '1.2. A2',
      '2. Beta',
      '2.1. B1',
      '3. Gamma',
      '3.1. C1',
      '3.2. C2',
    ]);
    const { hierarchical, at } = numberSteps(THREE_SECTIONS);
    expect(hierarchical).toBe(true);
    expect(at.some((h) => h?.label.includes('Paso'))).toBe(false);
  });

  it('hereda el número de sección: primera acción de la sección 2 es 2.1.', () => {
    const steps = [section('Uno'), action('a'), section('Dos'), action('primera de dos')];
    expect(labels(steps)[3]).toBe('2.1. primera de dos');
    expect(labels(steps)).not.toContain('1.1. primera de dos');
    expect(labels(steps)[3]).not.toMatch(/^1\./);
  });

  it('notas y reglas no se numeran y no desplazan N.M.', () => {
    const steps = [
      section('Uno'),
      action('primero'),
      note('aviso'),
      rule('condicional'),
      action('segundo'),
    ];
    expect(labels(steps)).toEqual([
      '1. Uno',
      '1.1. primero',
      undefined,
      undefined,
      '1.2. segundo',
    ]);
  });

  it('acciones sin imagen no consumen número', () => {
    const steps = [section('Uno'), action('con foto'), action('sin foto', { img: false }), action('otra')];
    expect(labels(steps)).toEqual(['1. Uno', '1.1. con foto', undefined, '1.2. otra']);
  });

  it('con requireSize, acciones sin width/height no consumen número', () => {
    const steps = [
      section('Uno'),
      action('ok', { width: 10, height: 10 }),
      action('sin tamaño'),
      action('también ok', { width: 8, height: 8 }),
    ];
    expect(labels(steps, { requireSize: true })).toEqual([
      '1. Uno',
      '1.1. ok',
      undefined,
      '1.2. también ok',
    ]);
    expect(labels(steps)).toEqual(['1. Uno', '1.1. ok', '1.2. sin tamaño', '1.3. también ok']);
  });

  it('acciones antes de la primera sección fallan sin inventar 0.1. ni Paso N', () => {
    const steps = [action('huérfana'), note('antes'), section('Uno'), action('dentro')];
    expect(() => numberSteps(steps)).toThrowError(/^hay pasos fuera de toda sección$/);
  });

  it('notas y reglas antes de la primera sección no disparan el error', () => {
    const steps = [note('aviso'), rule('condicional'), section('Uno'), action('dentro')];
    expect(labels(steps)).toEqual([undefined, undefined, '1. Uno', '1.1. dentro']);
  });

  it('acción sin imagen antes de la primera sección también es huérfana', () => {
    const steps = [action('sin foto', { img: false }), section('Uno'), action('dentro')];
    expect(() => numberSteps(steps)).toThrowError(/^hay pasos fuera de toda sección$/);
  });

  it('con requireSize, acción sin tamaño antes de la primera sección también falla', () => {
    const steps = [action('sin tamaño'), section('Uno'), action('ok', { width: 10, height: 10 })];
    expect(() => numberSteps(steps, { requireSize: true })).toThrowError(
      /^hay pasos fuera de toda sección$/,
    );
  });

  it('usa "Sección" si el caption de sección está vacío', () => {
    expect(labels([section(''), action('a')])[0]).toBe('1. Sección');
  });
});

describe('numberSteps — plano', () => {
  it('sin secciones conserva Paso N. título y no inventa sección 1', () => {
    const crudo = [
      action('01-abrir-contabilidad'),
      action('02-tablero'),
      action('03-abrir-facturas'),
      action('04-nuevo'),
      action('05-cliente'),
      action('06-agregar-linea'),
      action('06b-producto'),
      action('07-borrador'),
    ];
    const numbered = numberSteps(crudo);
    expect(numbered.hierarchical).toBe(false);
    expect(labels(crudo)).toEqual([
      'Paso 1. 01-abrir-contabilidad',
      'Paso 2. 02-tablero',
      'Paso 3. 03-abrir-facturas',
      'Paso 4. 04-nuevo',
      'Paso 5. 05-cliente',
      'Paso 6. 06-agregar-linea',
      'Paso 7. 06b-producto',
      'Paso 8. 07-borrador',
    ]);
    expect(numbered.at.every((h) => h?.kind === 'action')).toBe(true);
  });

  it('notas no cuentan en modo plano', () => {
    const steps = [action('uno'), note(), action('dos')];
    expect(labels(steps)).toEqual(['Paso 1. uno', undefined, 'Paso 2. dos']);
  });
});

describe('buildTocEntries — mismo walk que el cuerpo', () => {
  it('con secciones lista solo esas etiquetas, sin pasos ni prefijo extra', () => {
    const entries = buildTocEntries(THREE_SECTIONS);
    expect(entries.map(tocLine)).toEqual(['1. Alfa', '2. Beta', '3. Gamma']);
    expect(entries.every((e) => e.kind === 'section')).toBe(true);
    const bodySectionLabels = numberSteps(THREE_SECTIONS)
      .at.filter((h) => h?.kind === 'section')
      .map((h) => h!.label);
    expect(entries.map(tocLine)).toEqual(bodySectionLabels);
  });

  it('sin secciones conserva Paso N. título', () => {
    const steps = [action('uno'), action('dos')];
    const entries = buildTocEntries(steps);
    expect(entries.map(tocLine)).toEqual(['Paso 1. uno', 'Paso 2. dos']);
    expect(entries.map((e) => e.kind)).toEqual(['action', 'action']);
  });

  it('con acción antes de la primera sección no produce índice', () => {
    const steps = [action('huérfana'), section('Uno'), action('dentro')];
    expect(() => buildTocEntries(steps)).toThrowError(/^hay pasos fuera de toda sección$/);
  });
});
