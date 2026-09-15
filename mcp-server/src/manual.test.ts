import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FORMAT,
  FORMAT_VERSION,
  parseProjectFile,
  serializeProjectFile,
  type ProjectFile,
} from '../../src/lib/projectFile.js';
import { listManuals, loadProject, saveProject } from './manual.js';

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

const temps: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'manuallite-mcp-'));
  temps.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('loadProject / saveProject', () => {
  it('carga una fixture compacta v1 y conserva los mismos campos', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'ok.manuallite.json');
    const original = fixture();
    await writeFile(filePath, JSON.stringify(original), 'utf8');

    const loaded = await loadProject(filePath);

    expect(loaded).toEqual(original);
    expect(loaded.app).toBe(FORMAT);
    expect(loaded.formatVersion).toBe(1);
    expect(loaded.manual).toEqual(original.manual);
    expect(loaded.steps).toEqual(original.steps);
  });

  it('rechaza app distinto o steps que no es array con el mensaje del núcleo', async () => {
    const dir = await tempDir();
    const badApp = path.join(dir, 'bad-app.manuallite.json');
    const badSteps = path.join(dir, 'bad-steps.manuallite.json');
    await writeFile(badApp, JSON.stringify({ ...fixture(), app: 'Otro' }), 'utf8');
    await writeFile(
      badSteps,
      JSON.stringify({ ...fixture(), steps: { caption: 'no-array' } }),
      'utf8',
    );

    await expect(loadProject(badApp)).rejects.toThrow(
      'El archivo no es un proyecto válido de ManualLite.',
    );
    await expect(loadProject(badSteps)).rejects.toThrow(
      'El archivo no es un proyecto válido de ManualLite.',
    );
  });

  it('envuelve JSON roto con la ruta y no deja proyecto', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'roto.manuallite.json');
    await writeFile(filePath, '{ esto no es json', 'utf8');

    await expect(loadProject(filePath)).rejects.toThrow(
      `El archivo no es JSON válido: ${filePath}`,
    );
  });

  it('envuelve un fallo de lectura', async () => {
    const missing = path.join(await tempDir(), 'no-existe.manuallite.json');

    await expect(loadProject(missing)).rejects.toThrow(`No se pudo leer el archivo: ${missing}`);
  });

  it('al corregir caption y guardar no altera los dataURL', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'corrige.manuallite.json');
    await writeFile(filePath, JSON.stringify(fixture()), 'utf8');

    const project = await loadProject(filePath);
    const screenshotBefore = project.steps[0]?.screenshot;
    const annotatedBefore = project.steps[0]?.annotated;
    project.steps[0]!.caption = 'Abrir la app Contabilidad';
    await saveProject(filePath, project);

    const again = await loadProject(filePath);
    expect(again.steps[0]?.caption).toBe('Abrir la app Contabilidad');
    expect(again.steps[0]?.screenshot).toBe(screenshotBefore);
    expect(again.steps[0]?.annotated).toBe(annotatedBefore);
    expect(again.steps[0]?.screenshot).toBe(PNG_1X1);
    expect(again.steps[0]?.annotated).toBe(PNG_1X1);
  });

  it('round-trip parse → serialize conserva igualdad de campos', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'round.manuallite.json');
    const original = fixture();
    await saveProject(filePath, original);

    const loaded = await loadProject(filePath);
    const again = parseProjectFile(serializeProjectFile(loaded));

    expect(again).toEqual(original);
    expect(again.app).toBe(original.app);
    expect(again.formatVersion).toBe(original.formatVersion);
    expect(again.manual).toEqual(original.manual);
    expect(again.steps).toEqual(original.steps);
  });
});

describe('scripts/export-pdf.ts', () => {
  it('rechaza app distinto con el mensaje del núcleo y sale distinto de 0', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'bad-app.manuallite.json');
    await writeFile(filePath, JSON.stringify({ ...fixture(), app: 'Otro' }), 'utf8');

    const repoRoot = path.resolve(import.meta.dir, '../..');
    const proc = Bun.spawn({
      cmd: ['bun', 'run', 'scripts/export-pdf.ts', filePath],
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('El archivo no es un proyecto válido de ManualLite.');
  });
});

describe('listManuals', () => {
  it('lista solo el válido y ignora el inválido', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'ok.manuallite.json'), JSON.stringify(fixture()), 'utf8');
    await writeFile(
      path.join(dir, 'bad.manuallite.json'),
      JSON.stringify({ ...fixture(), app: 'Otro' }),
      'utf8',
    );
    await writeFile(path.join(dir, 'not-a-manual.json'), JSON.stringify(fixture()), 'utf8');

    const listed = await listManuals(dir);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.title).toBe('Cómo crear una factura de cliente');
    expect(listed[0]?.stepCount).toBe(2);
    expect(listed[0]?.path).toBe(path.join(dir, 'ok.manuallite.json'));
  });
});
