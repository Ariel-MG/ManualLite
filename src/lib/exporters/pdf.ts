import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Manual, PageSize, Step, StepVariant } from '../../types';

/** El PDF acepta Blob (editor) o data URL (export desde .manuallite.json). */
type PdfImage = Blob | string;
type PdfVariant = Omit<StepVariant, 'screenshot' | 'annotated'> & {
  screenshot?: PdfImage;
  annotated?: PdfImage;
};
export type PdfStep = Omit<Step, 'screenshot' | 'annotated' | 'variants'> & {
  screenshot?: PdfImage;
  annotated?: PdfImage;
  variants?: PdfVariant[];
};
import { DEFAULT_ACCENT } from '../../types';
import { blobToDataURL, safeName } from '../blob';
import { exportImageDataUrl, type ImageQuality } from '../image';
import {
  imageFit,
  packBlocks,
  textHeight,
  type MeasuredBlock,
  type PlacedBlock,
} from './pdfLayout';
import { numberSteps } from './numbering';
import { buildTocEntries, tocLine } from './toc';

// pdfmake necesita su sistema de fuentes virtual (vfs). El shape ha cambiado
// entre versiones, por eso resolvemos de forma defensiva.
function resolvePdfMakeVfs(mod: unknown): Record<string, string> {
  const rec = mod as Record<string, unknown> | undefined;
  if (rec && typeof rec['Roboto-Medium.ttf'] === 'string') return rec as Record<string, string>;
  const nested = rec?.pdfMake as { vfs?: Record<string, string> } | undefined;
  if (nested?.vfs) return nested.vfs;
  if (rec?.vfs && typeof (rec.vfs as Record<string, unknown>)['Roboto-Medium.ttf'] === 'string') {
    return rec.vfs as Record<string, string>;
  }
  const def = rec?.default as Record<string, unknown> | undefined;
  if (def && typeof def['Roboto-Medium.ttf'] === 'string') return def as Record<string, string>;
  const defNested = def?.pdfMake as { vfs?: Record<string, string> } | undefined;
  if (defNested?.vfs) return defNested.vfs;
  throw new Error('No se pudo cargar el VFS de fuentes de pdfmake.');
}

(pdfMake as unknown as { vfs: Record<string, string> }).vfs = resolvePdfMakeVfs(pdfFonts);

const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 },
};
const MARGIN_X = 48;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 56;

/** Separación a cada lado del divisor entre pasos. */
const DIVIDER_GAP = 10;
/** Alto total que ocupa un divisor: hueco + línea + hueco. */
const DIVIDER_H = DIVIDER_GAP * 2 + 0.7;
/** Recuadro de captura: padding interno + borde (no se encoge con la imagen). */
const IMG_FRAME_PAD = 4;
const IMG_FRAME_BORDER = 1;
const IMG_FRAME_CHROME = IMG_FRAME_PAD * 2 + IMG_FRAME_BORDER * 2;

/**
 * Un bloque en construcción: lo que mide y cómo se dibuja una vez que el
 * empaquetador ha decidido dónde va y con qué escala.
 */
interface Draft {
  measured: MeasuredBlock;
  render: (placed: PlacedBlock) => Content;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Línea divisoria entre pasos. Se emite como último hijo del stack del bloque. */
function divider(contentWidth: number): Content {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.7, lineColor: '#e5e7eb' }],
    margin: [0, DIVIDER_GAP, 0, DIVIDER_GAP],
  };
}

/** Captura encerrada en un recuadro (mismo criterio que el HTML). */
function framedImage(dataUrl: string, width: number, height: number): Content {
  return {
    table: {
      widths: [width],
      body: [[{ image: dataUrl, width, height }]],
    },
    alignment: 'center',
    layout: {
      hLineWidth: () => IMG_FRAME_BORDER,
      vLineWidth: () => IMG_FRAME_BORDER,
      hLineColor: () => '#e5e7eb',
      vLineColor: () => '#e5e7eb',
      paddingLeft: () => IMG_FRAME_PAD,
      paddingRight: () => IMG_FRAME_PAD,
      paddingTop: () => IMG_FRAME_PAD,
      paddingBottom: () => IMG_FRAME_PAD,
    },
  };
}

function tocContent(steps: PdfStep[], accent: string): Content {
  const { hierarchical } = numberSteps(steps, { requireSize: true });
  const entries = buildTocEntries(steps, { requireSize: true });
  const body = entries.map((entry, i) => {
    const isSection = entry.kind === 'section';
    const line = tocLine(entry);
    return [
      {
        text: hierarchical ? line : `${i + 1}.  ${line}`,
        bold: isSection,
        fontSize: isSection ? 12 : 11,
        color: isSection ? accent : '#111827',
        margin: [4, 3, 4, 3],
      },
    ];
  });
  return {
    stack: [
      { text: 'Índice', style: 'tocTitle' },
      {
        table: {
          widths: ['*'],
          body: body.length ? body : [[{ text: ' ' }]],
        },
        layout: {
          defaultBorder: false,
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === 0 || i === node.table.body.length ? 1 : 0,
          vLineWidth: () => 1,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
          fillColor: () => '#f9fafb',
          paddingLeft: () => 16,
          paddingRight: () => 16,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
    ],
    pageBreak: 'after',
  } as Content;
}

async function resolveImageSrc(
  img: Blob | string | undefined,
  quality: ImageQuality,
): Promise<string | undefined> {
  if (!img) return undefined;
  if (typeof img === 'string') return img;
  return exportImageDataUrl(img, quality);
}

export async function exportPdf(
  manual: Manual,
  steps: Step[],
  quality: ImageQuality = 'medium',
): Promise<void> {
  const doc = await buildPdfDoc(manual, steps, quality);
  pdfMake.createPdf(doc).download(`${safeName(manual.title)}.pdf`);
}

/**
 * Arma el documento pdfmake. Separado de la descarga para poder renderizarlo
 * y comprobar la paginación fuera del navegador.
 */
export async function buildPdfDoc(
  manual: Omit<Manual, 'logo'> & { logo?: Blob | string },
  steps: PdfStep[],
  quality: ImageQuality = 'medium',
): Promise<TDocumentDefinitions> {
  const ACCENT = manual.accentColor ?? DEFAULT_ACCENT;
  const pageSize: PageSize = manual.pageSize ?? 'A4';
  const pageW = PAGE_SIZES[pageSize].width;
  const contentWidth = pageW - MARGIN_X * 2;
  const usableHeight = PAGE_SIZES[pageSize].height - MARGIN_TOP - MARGIN_BOTTOM;
  // Tope de altura de captura: deja sitio al título, la descripción y el
  // divisor, de modo que un paso siempre quepa en una hoja.
  const maxImgHeight = usableHeight - 160;
  const logoDataUrl = !manual.logo
    ? undefined
    : typeof manual.logo === 'string'
      ? manual.logo
      : await blobToDataURL(manual.logo);

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

  // --- Índice persistente (mismo criterio que HTML/Markdown) ---
  const toc: Content = tocContent(steps, ACCENT);

  // --- Pasos: primera pasada, medir ---
  // Construimos cada bloque junto con su altura estimada. Los saltos de página
  // los decide `packBlocks` después, cuando ya conoce todas las alturas.
  const drafts: Draft[] = [];
  const numbering = numberSteps(steps, { requireSize: true });
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    const numbered = numbering.at[stepIndex];
    if (step.kind === 'section') {
      const caption = numbered?.label ?? (step.caption || 'Sección');
      // Cuando la sección continúa en la hoja en curso lleva una regla de color
      // encima para que se lea como corte de sección y no como un paso más.
      const height = textHeight(caption, 19, contentWidth) + 12 + 16;
      const heading = {
        text: caption,
        style: 'sectionHeading',
      } as Content;

      drafts.push({
        measured: { height, marginTop: 24, divider: 0, isSection: true },
        render: (placed) =>
          placed.firstOnPage
            ? ({
                ...(heading as object),
                pageBreak: placed.pageBreakBefore ? 'before' : undefined,
                margin: [0, 0, 0, 12],
              } as unknown as Content)
            : {
                stack: [
                  {
                    canvas: [
                      { type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 2, lineColor: ACCENT },
                    ],
                  },
                  { ...(heading as object), margin: [0, 14, 0, 12] } as unknown as Content,
                ],
                unbreakable: true,
                margin: [0, 24, 0, 0],
              },
      });
      continue;
    }

    if (step.kind === 'note' || step.kind === 'rule') {
      if (!step.description?.trim()) continue;
      const isNote = step.kind === 'note';
      const label = isNote ? 'Nota   ' : 'Regla   ';
      // La celda lleva 12 pt de margen a cada lado.
      const height = 10 + textHeight(label + step.description, 11, contentWidth - 24) + 10;
      const body: Content = {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: [
                  { text: label, bold: true, color: isNote ? ACCENT : '#1d4ed8' },
                  { text: step.description, color: isNote ? '#92400e' : '#1e3a8a' },
                ],
                margin: [12, 10, 12, 10],
              },
            ],
          ],
        },
        layout: { defaultBorder: false, fillColor: () => (isNote ? '#fffbeb' : '#eff6ff') },
      };

      drafts.push({
        measured: { height, marginTop: 6, divider: DIVIDER_H },
        render: (placed) => ({
          stack: placed.showDivider ? [body, divider(contentWidth)] : [body],
          unbreakable: placed.unbreakable,
          pageBreak: placed.pageBreakBefore ? 'before' : undefined,
          margin: [0, placed.firstOnPage ? 0 : 6, 0, 0],
        }),
      });
      continue;
    }

    // Acción (con imagen). El número solo se consume si el paso llega al PDF,
    // para no dejar huecos ("Paso 1, Paso 3") ni divergir de HTML/Markdown.
    const img = step.annotated ?? step.screenshot;
    if (!img || !step.width || !step.height || !numbered) continue;
    const dataUrl = await resolveImageSrc(img, quality);
    if (!dataUrl) continue;
    const [w, h] = imageFit(step.width, step.height, contentWidth, maxImgHeight);

    const headingText = numbering.hierarchical
      ? numbered.label
      : `${numbered.token}   ${numbered.caption}`;
    const gap = numbering.hierarchical ? ' ' : '   ';
    const heading = {
      text: numbered.token
        ? [
            { text: numbered.token, color: ACCENT, bold: true },
            { text: `${gap}${numbered.caption}`, color: '#111827', bold: true },
          ]
        : [{ text: numbered.caption, color: '#111827', bold: true }],
      style: 'stepHeading',
      margin: [0, 0, 0, 10],
    } as Content;

    const headingH = textHeight(headingText, 15, contentWidth) + 10;
    const descH = step.description?.trim()
      ? 10 + textHeight(step.description, 11, contentWidth, 1.4)
      : 0;

    drafts.push({
      measured: {
        height: headingH + h + IMG_FRAME_CHROME + descH,
        marginTop: 6,
        divider: DIVIDER_H,
        imageHeight: h,
      },
      render: (placed) => {
        const block: Content[] = [
          heading,
          framedImage(dataUrl, w * placed.imageScale, h * placed.imageScale),
        ];
        if (step.description?.trim()) {
          block.push({ text: step.description, style: 'stepDesc', margin: [0, 10, 0, 0] });
        }
        if (placed.showDivider) block.push(divider(contentWidth));
        return {
          stack: block,
          unbreakable: placed.unbreakable,
          pageBreak: placed.pageBreakBefore ? 'before' : undefined,
          margin: [0, placed.firstOnPage ? 0 : 6, 0, 0],
        };
      },
    });

    // Caminos alternativos (variantes), cada uno como bloque indentado.
    let vi = 0;
    for (const v of step.variants ?? []) {
      vi += 1;
      const label = v.label || `Opción ${vi}`;
      const vWidth = contentWidth - 16;
      const vImg = v.annotated ?? v.screenshot;
      const vUrl = await resolveImageSrc(vImg, quality);
      const [vw, vh] =
        vUrl && v.width && v.height ? imageFit(v.width, v.height, vWidth, maxImgHeight) : [0, 0];
      const vDescH = v.description?.trim() ? 8 + textHeight(v.description, 11, vWidth, 1.4) : 0;
      const vLabelH = textHeight(label, 11, vWidth) + 6;
      const vFrame = vUrl && vh > 0 ? IMG_FRAME_CHROME : 0;

      drafts.push({
        measured: {
          height: vLabelH + vh + vFrame + vDescH,
          marginTop: 8,
          divider: DIVIDER_H,
          imageHeight: vh || undefined,
        },
        render: (placed) => {
          const vBlock: Content[] = [{ text: label, bold: true, color: ACCENT, margin: [0, 0, 0, 6] }];
          if (vUrl && vh > 0) {
            vBlock.push(framedImage(vUrl, vw * placed.imageScale, vh * placed.imageScale));
          }
          if (v.description?.trim()) {
            vBlock.push({ text: v.description, style: 'stepDesc', margin: [0, 8, 0, 0] });
          }
          if (placed.showDivider) vBlock.push(divider(contentWidth - 16));
          return {
            stack: vBlock,
            unbreakable: placed.unbreakable,
            pageBreak: placed.pageBreakBefore ? 'before' : undefined,
            margin: [16, placed.firstOnPage ? 0 : 8, 0, 0],
          };
        },
      });
    }
  }

  // Un bloque pierde el divisor si es el último del documento o si le sigue un
  // encabezado de sección, que ya separa de sobra por sí mismo. El divisor del
  // último bloque de cada página lo quita `packBlocks`.
  for (let i = 0; i < drafts.length; i++) {
    const next = drafts[i + 1];
    if (next && !next.measured.isSection) continue;
    drafts[i].measured = { ...drafts[i].measured, divider: 0 };
  }

  // --- Pasos: segunda pasada, colocar ---
  const placements = packBlocks(
    drafts.map((d) => d.measured),
    usableHeight,
  );
  const stepContent = drafts.map((d, i) => d.render(placements[i]));

  // Marca del documento: usamos los datos del manual para que en "Propiedades
  // del documento" aparezca la marca del cliente y no rastro de la herramienta.
  const brand = manual.company || manual.author || manual.title;
  const keywords = [manual.title, manual.company, manual.version, 'manual de usuario']
    .filter(Boolean)
    .join(', ');

  const doc: TDocumentDefinitions = {
    pageSize,
    pageMargins: [MARGIN_X, 64, MARGIN_X, 56],
    info: {
      title: manual.title,
      author: manual.author || manual.company || brand,
      subject: manual.subtitle || 'Manual de usuario',
      keywords,
      creator: brand,
      producer: brand,
    },
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
              { text: manual.company ?? '', color: '#d1d5db', fontSize: 9, alignment: 'right' },
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

  return doc;
}
