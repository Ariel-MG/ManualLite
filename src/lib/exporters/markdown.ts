import JSZip from 'jszip';
import type { Manual, Step } from '../../types';
import { downloadBlob, safeName } from '../blob';

/**
 * Genera un .md con las imágenes referenciadas en una carpeta `images/`,
 * todo empaquetado en un .zip.
 */
export async function exportMarkdown(manual: Manual, steps: Step[]): Promise<void> {
  const zip = new JSZip();
  const imagesDir = zip.folder('images')!;

  const date = new Date(manual.createdAt).toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [];
  lines.push(`# ${manual.title}`, '');
  if (manual.subtitle) lines.push(`_${manual.subtitle}_`, '');
  if (manual.logo) {
    imagesDir.file('logo.png', manual.logo);
    lines.push(`![logo](images/logo.png)`, '');
  }
  lines.push(`> ${date}`, '');

  // Índice
  lines.push('## Índice', '');
  steps.forEach((s, i) => {
    const anchor = `paso-${i + 1}-${slug(s.caption)}`;
    lines.push(`${i + 1}. [Paso ${i + 1}. ${s.caption}](#${anchor})`);
  });
  lines.push('');

  // Pasos
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const file = `images/step-${i + 1}.png`;
    imagesDir.file(`step-${i + 1}.png`, s.annotated ?? s.screenshot);
    lines.push(`## Paso ${i + 1}. ${s.caption}`, '');
    lines.push(`![Paso ${i + 1}](${file})`, '');
  }

  zip.file(`${safeName(manual.title)}.md`, lines.join('\n'));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${safeName(manual.title)}.zip`);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-');
}
