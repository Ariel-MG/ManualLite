import { describe, expect, it } from 'vitest';
import {
  FORMAT,
  FORMAT_VERSION,
  parseProjectFile,
  serializeProjectFile,
  type ProjectFile,
} from './projectFile';

/** PNG 1×1; sustituye las dataURL grandes de un entregado formatVersion 1. */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function fixture(): ProjectFile {
  return {
    app: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: 1789151676548,
    manual: {
      title: 'Cómo crear una factura de cliente',
      accentColor: '#04C4D9',
      company: 'ARW',
      pageSize: 'A4',
      createdAt: 1789151676465,
      subtitle: 'Contabilidad · Odoo 18',
      version: '1.0',
      confidentiality: 'Confidencial',
    },
    steps: [
      {
        kind: 'action',
        caption: 'Abrir Contabilidad',
        description: 'En el menú de aplicaciones se abre Contabilidad.',
        screenshot: PNG_1X1,
        annotated: PNG_1X1,
        width: 1440,
        height: 900,
        click: { x: 788.1484375, y: 306.5 },
        clickOnImage: { x: 788.1484375, y: 306.5 },
        url: 'http://localhost:9050/odoo',
      },
      {
        kind: 'section',
        caption: 'Contabilidad',
      },
    ],
  };
}

describe('parseProjectFile / serializeProjectFile', () => {
  it('conserva app, formatVersion, portada, pasos e imágenes en un round-trip', () => {
    const original = fixture();
    const parsed = parseProjectFile(JSON.stringify(original));
    const again = parseProjectFile(serializeProjectFile(parsed));

    expect(again.app).toBe(FORMAT);
    expect(again.formatVersion).toBe(1);
    expect(again.exportedAt).toBe(original.exportedAt);
    expect(again.manual).toEqual(original.manual);
    expect(again.steps).toEqual(original.steps);
    expect(again).toEqual(original);
  });

  it('rechaza app distinto o steps que no es array con el error de hoy', () => {
    const invalidApp = JSON.stringify({ ...fixture(), app: 'Otro' } as unknown);
    const invalidSteps = JSON.stringify({
      ...fixture(),
      steps: { caption: 'no-array' },
    } as unknown);

    expect(() => parseProjectFile(invalidApp)).toThrow(
      'El archivo no es un proyecto válido de ManualLite.',
    );
    expect(() => parseProjectFile(invalidSteps)).toThrow(
      'El archivo no es un proyecto válido de ManualLite.',
    );
  });

  it('acepta campos opcionales ausentes y no los inventa al serializar', () => {
    const parsed = parseProjectFile(JSON.stringify(fixture()));
    const serialized = JSON.parse(serializeProjectFile(parsed)) as ProjectFile;

    expect(parsed.manual).not.toHaveProperty('logo');
    expect(parsed.steps[1]).not.toHaveProperty('screenshot');
    expect(parsed.steps[1]).not.toHaveProperty('annotated');
    expect(serialized.manual).not.toHaveProperty('logo');
    expect(serialized.steps[1]).not.toHaveProperty('screenshot');
    expect(serialized.steps[1]).not.toHaveProperty('annotated');
  });

  it('acepta steps vacío y lo conserva al serializar', () => {
    const original = { ...fixture(), steps: [] };
    const parsed = parseProjectFile(JSON.stringify(original));
    const again = parseProjectFile(serializeProjectFile(parsed));

    expect(parsed.steps).toEqual([]);
    expect(again.steps).toEqual([]);
  });
});
