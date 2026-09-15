import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manual, Step } from '../../types';
import { downloadBlob } from '../blob';
import { exportHtml } from './html';

vi.mock('../blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../blob')>();
  return { ...actual, downloadBlob: vi.fn() };
});

vi.mock('../image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../image')>();
  return {
    ...actual,
    exportImageDataUrl: vi.fn(async () => 'data:image/png;base64,aaa'),
  };
});

const PNG = new Blob(['png'], { type: 'image/png' });

function manual(): Manual {
  return { id: 'm', title: 'Test', createdAt: 0, updatedAt: 0 };
}

function section(caption: string, order: number): Step {
  return { id: `sec-${order}`, manualId: 'm', order, kind: 'section', caption, createdAt: 0 };
}

function action(caption: string, order: number): Step {
  return {
    id: `act-${order}`,
    manualId: 'm',
    order,
    kind: 'action',
    caption,
    screenshot: PNG,
    createdAt: 0,
  };
}

const THREE_SECTIONS: Step[] = [
  section('Alfa', 0),
  action('A1', 1),
  action('A2', 2),
  section('Beta', 3),
  action('B1', 4),
  section('Gamma', 5),
  action('C1', 6),
  action('C2', 7),
];

async function exportedHtml(steps: Step[]): Promise<string> {
  vi.mocked(downloadBlob).mockClear();
  await exportHtml(manual(), steps, 'png');
  const blob = vi.mocked(downloadBlob).mock.calls[0][0] as Blob;
  return blob.text();
}

describe('exportHtml — jerárquico', () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockReset();
  });

  it('índice solo con secciones en ul.toc-list y badge 1.1. en la primera acción', async () => {
    const html = await exportedHtml(THREE_SECTIONS);
    const toc = html.match(/<nav class="toc">[\s\S]*?<\/nav>/)?.[0] ?? '';

    expect(toc).toContain('class="toc-list"');
    expect(toc).not.toMatch(/<ol[\s>]/);
    expect(toc).toContain('1. Alfa');
    expect(toc).toContain('2. Beta');
    expect(toc).toContain('3. Gamma');
    expect(toc).not.toContain('A1');
    expect(toc).not.toContain('1.1.');

    expect(html).toContain('<span class="num compound">1.1.</span>');
  });

  it('no produce archivo si hay acciones antes de la primera sección', async () => {
    const steps = [action('huérfana', 0), section('Uno', 1), action('dentro', 2)];
    await expect(exportHtml(manual(), steps, 'png')).rejects.toThrow(
      /^hay pasos fuera de toda sección$/,
    );
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
