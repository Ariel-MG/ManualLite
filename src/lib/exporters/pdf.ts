import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Manual, Step } from '../../types';
import { DEFAULT_ACCENT } from '../../types';
import { blobToDataURL, safeName } from '../blob';
import { exportImageDataUrl, type ImageQuality } from '../image';

// pdfmake necesita su sistema de fuentes virtual (vfs). El shape ha cambiado
// entre versiones, por eso resolvemos de forma defensiva.
const vfs =
  (pdfFonts as unknown as { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> })
    .pdfMake?.vfs ??
  (pdfFonts as unknown as { vfs: Record<string, string> }).vfs;
(pdfMake as unknown as { vfs: Record<string, string> }).vfs = vfs;

const PAGE_W = 595.28; // A4 en pt
const MARGIN_X = 48;
const PAGE_CONTENT_WIDTH = PAGE_W - MARGIN_X * 2;
const MAX_IMG_HEIGHT = 560; // evita que capturas muy altas desborden la página

function imageFit(step: Step): [number, number] {
  const ratio = step.height / step.width;
  let w = Math.min(PAGE_CONTENT_WIDTH, step.width);
  let h = w * ratio;
  if (h > MAX_IMG_HEIGHT) {
    h = MAX_IMG_HEIGHT;
    w = h / ratio;
  }
  return [w, h];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function exportPdf(
  manual: Manual,
  steps: Step[],
  quality: ImageQuality = 'medium',
): Promise<void> {
  const ACCENT = manual.accentColor ?? DEFAULT_ACCENT;
  const logoDataUrl = manual.logo ? await blobToDataURL(manual.logo) : undefined;

  // --- Portada ---
  const cover: Content[] = [];
  cover.push({
    text: 'MANUAL DE USUARIO',
    color: ACCENT,
    bold: true,
    fontSize: 11,
    characterSpacing: 3,
    alignment: 'center',
    margin: [0, logoDataUrl ? 30 : 150, 0, 18],
  });
  if (logoDataUrl) {
    cover.push({ image: logoDataUrl, fit: [210, 110], alignment: 'center', margin: [0, 0, 0, 28] });
  }
  cover.push({ text: manual.title, style: 'coverTitle', alignment: 'center' });
  if (manual.subtitle) {
    cover.push({ text: manual.subtitle, style: 'coverSubtitle', alignment: 'center' });
  }
  // Pequeña línea decorativa
  cover.push({
    canvas: [{ type: 'line', x1: PAGE_CONTENT_WIDTH / 2 - 30, y1: 0, x2: PAGE_CONTENT_WIDTH / 2 + 30, y2: 0, lineWidth: 2, lineColor: ACCENT }],
    margin: [0, 22, 0, 18],
  });
  cover.push({
    text: formatDate(manual.createdAt),
    style: 'coverDate',
    alignment: 'center',
    pageBreak: 'after',
  });

  // --- Índice automático ---
  const toc: Content = {
    toc: { title: { text: 'Índice', style: 'tocTitle' } },
    pageBreak: 'after',
  };

  // --- Pasos ---
  const stepContent: Content[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const dataUrl = await exportImageDataUrl(step.annotated ?? step.screenshot, quality);
    const [w, h] = imageFit(step);

    const heading = {
      text: [
        { text: `Paso ${i + 1}`, color: ACCENT, bold: true },
        { text: `   ${step.caption}`, color: '#111827', bold: true },
      ],
      style: 'stepHeading',
      tocItem: true,
      tocStyle: { fontSize: 11 },
      margin: [0, 0, 0, 10],
    } as unknown as Content;

    const block: Content[] = [
      heading,
      { image: dataUrl, width: w, height: h, alignment: 'center' },
    ];
    if (step.description?.trim()) {
      block.push({ text: step.description, style: 'stepDesc', margin: [0, 10, 0, 0] });
    }

    // Cada paso se mantiene junto y no se parte entre páginas.
    stepContent.push({ stack: block, unbreakable: true, margin: [0, i === 0 ? 0 : 6, 0, 0] });

    if (i < steps.length - 1) {
      stepContent.push({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_CONTENT_WIDTH, y2: 0, lineWidth: 0.7, lineColor: '#e5e7eb' }],
        margin: [0, 20, 0, 20],
      });
    }
  }

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [MARGIN_X, 64, MARGIN_X, 56],
    content: [...cover, toc, ...stepContent],
    styles: {
      coverTitle: { fontSize: 32, bold: true, margin: [0, 0, 0, 8] },
      coverSubtitle: { fontSize: 15, color: '#6b7280', margin: [0, 0, 0, 0] },
      coverDate: { fontSize: 11, color: '#9ca3af' },
      tocTitle: { fontSize: 24, bold: true, color: '#111827', margin: [0, 0, 0, 22] },
      stepHeading: { fontSize: 15 },
      stepDesc: { fontSize: 11, color: '#374151', lineHeight: 1.4 },
    },
    defaultStyle: { fontSize: 11, color: '#111827' },
    // Franja de color en la cabecera de las páginas de contenido (no en portada).
    background: (currentPage) =>
      currentPage === 1
        ? { canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_W, h: 6, color: ACCENT }] }
        : '',
    header: (currentPage) =>
      currentPage > 1
        ? {
            margin: [MARGIN_X, 28, MARGIN_X, 0],
            columns: [
              { text: manual.title, color: '#9ca3af', fontSize: 9 },
              { text: 'ManualLite', color: '#d1d5db', fontSize: 9, alignment: 'right' },
            ],
          }
        : '',
    footer: (currentPage, pageCount) =>
      currentPage > 1
        ? {
            margin: [MARGIN_X, 12, MARGIN_X, 0],
            stack: [
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: PAGE_CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' },
                ],
              },
              {
                text: `Página ${currentPage} de ${pageCount}`,
                alignment: 'center',
                fontSize: 9,
                color: '#9ca3af',
                margin: [0, 6, 0, 0],
              },
            ],
          }
        : '',
  };

  pdfMake.createPdf(doc).download(`${safeName(manual.title)}.pdf`);
}
