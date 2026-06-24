import JSZip from 'jszip';
import type { Manual, Step } from '../../types';
import { downloadBlob, safeName } from '../blob';
import { imageExt, reencode, type ImageQuality } from '../image';

/**
 * Genera un .md con las imágenes referenciadas en una carpeta `images/`,
 * todo empaquetado en un .zip.
 */
export async function exportMarkdown(
  manual: Manual,
  steps: Step[],
  quality: ImageQuality = 'medium',
): Promise<void> {
  const zip = new JSZip();
  const imagesDir = zip.folder('images')!;
  const ext = imageExt(quality);

  const date = new Date(manual.createdAt).toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [];
  if (manual.company) lines.push(`**${manual.company}**`, '');
  lines.push(`# ${manual.title}`, '');
  if (manual.subtitle) lines.push(`_${manual.subtitle}_`, '');
  if (manual.logo) {
    imagesDir.file('logo.png', manual.logo);
    lines.push(`![logo](images/logo.png)`, '');
  }
  const meta = [
    manual.author ? `Autor: ${manual.author}` : null,
    manual.version ? `Versión: ${manual.version}` : null,
    date,
  ].filter(Boolean) as string[];
  lines.push(`> ${meta.join(' · ')}`, '');
  if (manual.confidentiality) lines.push(`> **${manual.confidentiality.toUpperCase()}**`, '');

  // Índice
  lines.push('## Índice', '');
  let n = 0;
  steps.forEach((s) => {
    if (s.kind === 'section') {
      lines.push(`- **${s.caption}**`);
    } else if (s.kind !== 'note') {
      n += 1;
      lines.push(`${n}. [Paso ${n}. ${s.caption}](#paso-${n}-${slug(s.caption)})`);
    }
  });
  lines.push('');

  // Cuerpo
  let actionNo = 0;
  for (const s of steps) {
    if (s.kind === 'section') {
      lines.push(`# ${s.caption || 'Sección'}`, '');
      continue;
    }
    if (s.kind === 'note') {
      if (s.description?.trim()) lines.push(`> **Nota:** ${s.description}`, '');
      continue;
    }
    const img = s.annotated ?? s.screenshot;
    if (!img) continue;
    actionNo += 1;
    const name = `step-${actionNo}.${ext}`;
    imagesDir.file(name, await reencode(img, quality));
    lines.push(`## Paso ${actionNo}. ${s.caption}`, '');
    lines.push(`![Paso ${actionNo}](images/${name})`, '');
    if (s.description) lines.push(s.description, '');
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
