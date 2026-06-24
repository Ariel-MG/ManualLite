import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Manual, PageSize, Step } from '../../types';
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

const PAGE_WIDTHS: Record<PageSize, number> = { A4: 595.28, LETTER: 612 };
const MARGIN_X = 48;
const MAX_IMG_HEIGHT = 560; // evita que capturas muy altas desborden la página

function imageFit(natW: number, natH: number, contentWidth: number): [number, number] {
  const ratio = natH / natW;
  let w = Math.min(contentWidth, natW);
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

/** Inserta una línea divisoria si el ítem no es el último. */
function addDivider(out: Content[], steps: Step[], i: number, contentWidth: number): void {
  if (i >= steps.length - 1) return;
  out.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.7, lineColor: '#e5e7eb' }],
    margin: [0, 20, 0, 20],
  });
}

export async function exportPdf(
  manual: Manual,
  steps: Step[],
  quality: ImageQuality = 'medium',
): Promise<void> {
  const ACCENT = manual.accentColor ?? DEFAULT_ACCENT;
  const pageSize: PageSize = manual.pageSize ?? 'A4';
  const pageW = PAGE_WIDTHS[pageSize];
  const contentWidth = pageW - MARGIN_X * 2;
  const logoDataUrl = manual.logo ? await blobToDataURL(manual.logo) : undefined;

  // --- Portada ---
  const cover: Content[] = [];
  if (manual.company) {
    cover.push({
      text: manual.company,
      color: '#6b7280',
      fontSize: 12,
      bold: true,
      alignment: 'center',
      margin: [0, 80, 0, 0],
    });
  }
  cover.push({
    text: 'MANUAL DE USUARIO',
    color: ACCENT,
    bold: true,
    fontSize: 11,
    characterSpacing: 3,
    alignment: 'center',
    margin: [0, manual.company ? 16 : logoDataUrl ? 30 : 150, 0, 18],
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
    canvas: [{ type: 'line', x1: contentWidth / 2 - 30, y1: 0, x2: contentWidth / 2 + 30, y2: 0, lineWidth: 2, lineColor: ACCENT }],
    margin: [0, 22, 0, 18],
  });

  // Metadatos (autor · versión · fecha)
  const meta = [
    manual.author ? `Autor: ${manual.author}` : null,
    manual.version ? `Versión: ${manual.version}` : null,
    formatDate(manual.createdAt),
  ].filter(Boolean) as string[];
  cover.push({ text: meta.join('   ·   '), style: 'coverDate', alignment: 'center' });

  if (manual.confidentiality) {
    cover.push({
      text: manual.confidentiality.toUpperCase(),
      color: ACCENT,
      fontSize: 10,
      bold: true,
      characterSpacing: 1.5,
      alignment: 'center',
      margin: [0, 26, 0, 0],
    });
  }
  // Salto de página al final de la portada.
  cover.push({ text: '', pageBreak: 'after' });

  // --- Índice automático ---
  const toc: Content = {
    toc: { title: { text: 'Índice', style: 'tocTitle' } },
    pageBreak: 'after',
  };

  // --- Pasos ---
  const stepContent: Content[] = [];
  let actionNo = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (step.kind === 'section') {
      stepContent.push({
        text: step.caption || 'Sección',
        style: 'sectionHeading',
        tocItem: true,
        tocStyle: { bold: true },
        margin: [0, i === 0 ? 0 : 16, 0, 12],
      } as unknown as Content);
      continue;
    }

    if (step.kind === 'note') {
      if (!step.description?.trim()) continue;
      stepContent.push({
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: [
                  { text: 'Nota   ', bold: true, color: ACCENT },
                  { text: step.description, color: '#92400e' },
                ],
                margin: [12, 10, 12, 10],
              },
            ],
          ],
        },
        layout: { defaultBorder: false, fillColor: () => '#fffbeb' },
        margin: [0, i === 0 ? 0 : 6, 0, 0],
      } as Content);
      addDivider(stepContent, steps, i, contentWidth);
      continue;
    }

    // Acción (con imagen)
    actionNo += 1;
    const img = step.annotated ?? step.screenshot;
    if (!img || !step.width || !step.height) continue;
    const dataUrl = await exportImageDataUrl(img, quality);
    const [w, h] = imageFit(step.width, step.height, contentWidth);

    const heading = {
      text: [
        { text: `Paso ${actionNo}`, color: ACCENT, bold: true },
        { text: `   ${step.caption}`, color: '#111827', bold: true },
      ],
      style: 'stepHeading',
      tocItem: true,
      tocStyle: { fontSize: 11 },
      margin: [0, 0, 0, 10],
    } as unknown as Content;

    const block: Content[] = [heading, { image: dataUrl, width: w, height: h, alignment: 'center' }];
    if (step.description?.trim()) {
      block.push({ text: step.description, style: 'stepDesc', margin: [0, 10, 0, 0] });
    }

    // Cada paso se mantiene junto y no se parte entre páginas.
    stepContent.push({ stack: block, unbreakable: true, margin: [0, i === 0 ? 0 : 6, 0, 0] });
    addDivider(stepContent, steps, i, contentWidth);
  }

  const doc: TDocumentDefinitions = {
    pageSize,
    pageMargins: [MARGIN_X, 64, MARGIN_X, 56],
    content: [...cover, toc, ...stepContent],
    styles: {
      coverTitle: { fontSize: 32, bold: true, margin: [0, 0, 0, 8] },
      coverSubtitle: { fontSize: 15, color: '#6b7280', margin: [0, 0, 0, 0] },
      coverDate: { fontSize: 11, color: '#9ca3af' },
      tocTitle: { fontSize: 24, bold: true, color: '#111827', margin: [0, 0, 0, 22] },
      sectionHeading: { fontSize: 19, bold: true, color: ACCENT },
      stepHeading: { fontSize: 15 },
      stepDesc: { fontSize: 11, color: '#374151', lineHeight: 1.4 },
    },
    defaultStyle: { fontSize: 11, color: '#111827' },
    // Franja de color en la cabecera de las páginas de contenido (no en portada).
    background: (currentPage) =>
      currentPage === 1
        ? { canvas: [{ type: 'rect', x: 0, y: 0, w: pageW, h: 6, color: ACCENT }] }
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
                  { type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' },
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
