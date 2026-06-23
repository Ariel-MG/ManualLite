import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Manual, Step } from '../../types';
import { blobToDataURL, safeName } from '../blob';

// pdfmake necesita su sistema de fuentes virtual (vfs). El shape ha cambiado
// entre versiones, por eso resolvemos de forma defensiva.
const vfs =
  (pdfFonts as unknown as { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> })
    .pdfMake?.vfs ??
  (pdfFonts as unknown as { vfs: Record<string, string> }).vfs;
(pdfMake as unknown as { vfs: Record<string, string> }).vfs = vfs;

const PAGE_CONTENT_WIDTH = 515; // A4 menos márgenes laterales

function imageFit(step: Step): [number, number] {
  const ratio = step.height / step.width;
  const w = Math.min(PAGE_CONTENT_WIDTH, step.width);
  return [w, w * ratio];
}

export async function exportPdf(manual: Manual, steps: Step[]): Promise<void> {
  const logoDataUrl = manual.logo ? await blobToDataURL(manual.logo) : undefined;

  // Portada
  const cover: Content[] = [];
  if (logoDataUrl) {
    cover.push({ image: logoDataUrl, fit: [220, 120], alignment: 'center', margin: [0, 120, 0, 30] });
  } else {
    cover.push({ text: '', margin: [0, 160, 0, 0] });
  }
  cover.push({ text: manual.title, style: 'coverTitle', alignment: 'center' });
  if (manual.subtitle) {
    cover.push({ text: manual.subtitle, style: 'coverSubtitle', alignment: 'center' });
  }
  cover.push({
    text: new Date(manual.createdAt).toLocaleDateString('es', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    style: 'coverDate',
    alignment: 'center',
    pageBreak: 'after',
  });

  // Índice automático
  const toc: Content = {
    toc: {
      title: { text: 'Índice', style: 'tocTitle' },
    },
    pageBreak: 'after',
  };

  // Pasos
  const stepContent: Content[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const imgBlob = step.annotated ?? step.screenshot;
    const dataUrl = await blobToDataURL(imgBlob);
    const [w, h] = imageFit(step);

    stepContent.push({
      text: `Paso ${i + 1}. ${step.caption}`,
      style: 'stepHeading',
      tocItem: true,
      tocStyle: { fontSize: 11 },
      margin: [0, i === 0 ? 0 : 20, 0, 8],
    });
    stepContent.push({ image: dataUrl, width: w, height: h, margin: [0, 0, 0, 6] });
    if (i < steps.length - 1) stepContent.push({ text: '', pageBreak: 'after' });
  }

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    content: [...cover, toc, ...stepContent],
    styles: {
      coverTitle: { fontSize: 30, bold: true, margin: [0, 0, 0, 10] },
      coverSubtitle: { fontSize: 15, color: '#6b7280', margin: [0, 0, 0, 20] },
      coverDate: { fontSize: 11, color: '#9ca3af' },
      tocTitle: { fontSize: 22, bold: true, margin: [0, 0, 0, 20] },
      stepHeading: { fontSize: 14, bold: true, color: '#111827' },
    },
    defaultStyle: { fontSize: 11, color: '#111827' },
    footer: (currentPage, pageCount) =>
      currentPage > 1
        ? {
            text: `${currentPage} / ${pageCount}`,
            alignment: 'center',
            fontSize: 9,
            color: '#9ca3af',
            margin: [0, 10, 0, 0],
          }
        : '',
  };

  pdfMake.createPdf(doc).download(`${safeName(manual.title)}.pdf`);
}
