import { describe, expect, it } from 'vitest';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Manual } from '../../types';
import { buildPdfDoc, type PdfStep } from './pdf';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function manual(): Manual {
  return { id: 'm', title: 'Test', createdAt: 0, updatedAt: 0 };
}

function section(caption: string, order: number): PdfStep {
  return { id: `sec-${order}`, manualId: 'm', order, kind: 'section', caption, createdAt: 0 };
}

function action(caption: string, order: number): PdfStep {
  return {
    id: `act-${order}`,
    manualId: 'm',
    order,
    kind: 'action',
    caption,
    screenshot: PNG_1X1,
    width: 10,
    height: 10,
    createdAt: 0,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function tocLines(doc: TDocumentDefinitions): string[] {
  const content = Array.isArray(doc.content) ? doc.content : [doc.content];
  for (const node of content) {
    if (!isRecord(node) || !Array.isArray(node.stack)) continue;
    const title = node.stack[0];
    if (!isRecord(title) || title.text !== 'Índice') continue;
    const tableWrap = node.stack[1];
    if (!isRecord(tableWrap) || !isRecord(tableWrap.table)) continue;
    const body = tableWrap.table.body as unknown[];
    return body.map((row) => {
      const cell = Array.isArray(row) ? row[0] : row;
      return isRecord(cell) && typeof cell.text === 'string' ? cell.text : '';
    });
  }
  return [];
}

function actionHeadings(
  node: unknown,
  out: { token: string; rest: string }[] = [],
): { token: string; rest: string }[] {
  if (Array.isArray(node)) {
    for (const child of node) actionHeadings(child, out);
    return out;
  }
  if (!isRecord(node)) return out;
  if (node.style === 'stepHeading' && Array.isArray(node.text)) {
    const runs = node.text as { text?: string }[];
    out.push({ token: runs[0]?.text ?? '', rest: runs[1]?.text ?? '' });
  }
  if ('stack' in node) actionHeadings(node.stack, out);
  return out;
}

const THREE_SECTIONS: PdfStep[] = [
  section('Alfa', 0),
  action('A1', 1),
  action('A2', 2),
  section('Beta', 3),
  action('B1', 4),
  section('Gamma', 5),
  action('C1', 6),
  action('C2', 7),
];

describe('buildPdfDoc', () => {
  it('TOC jerárquico es 1. Alfa, no 1.  1. Alfa, y el heading de acción es 1.1.', async () => {
    const doc = await buildPdfDoc(manual(), THREE_SECTIONS, 'png');
    const toc = tocLines(doc);
    expect(toc).toEqual(['1. Alfa', '2. Beta', '3. Gamma']);
    expect(toc.some((line) => line.includes('1.  1.'))).toBe(false);

    const headings = actionHeadings(doc.content);
    expect(headings[0]?.token).toBe('1.1.');
    expect(headings[0]?.rest).toBe(' A1');
  });

  it('plano dibuja Paso N y tres espacios, no Paso N.', async () => {
    const doc = await buildPdfDoc(manual(), [action('uno', 0), action('dos', 1)], 'png');
    const headings = actionHeadings(doc.content);
    expect(headings[0]?.token).toBe('Paso 1');
    expect(headings[0]?.rest).toBe('   uno');
    expect(headings[0]?.token.endsWith('.')).toBe(false);
  });
});
