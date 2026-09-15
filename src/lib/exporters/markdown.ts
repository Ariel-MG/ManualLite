import JSZip from 'jszip';
import type { Manual, Step } from '../../types';
import { downloadBlob, safeName } from '../blob';
import { imageExt, reencode, type ImageQuality } from '../image';
import { numberSteps } from './numbering';
import { buildTocEntries, tocLine } from './toc';

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

  const numbering = numberSteps(steps);

  // Índice persistente (mismo criterio que HTML/PDF)
  lines.push('## Índice', '');
  buildTocEntries(steps).forEach((entry, i) => {
    const line = tocLine(entry);
    if (numbering.hierarchical) {
      lines.push(`- **${line}**`);
      return;
    }
    if (entry.kind === 'section') {
      lines.push(`${i + 1}. **${line}**`);
    } else {
      lines.push(`${i + 1}. [${line}](#paso-${entry.actionNo}-${slug(entry.caption)})`);
    }
  });
  lines.push('');

  // Cuerpo
  let fileNo = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const numbered = numbering.at[i];
    if (s.kind === 'section') {
      lines.push(`# ${numbered?.label ?? (s.caption || 'Sección')}`, '');
      continue;
    }
    if (s.kind === 'note') {
      if (s.description?.trim()) lines.push(`> **Nota:** ${s.description}`, '');
      continue;
    }
    if (s.kind === 'rule') {
      if (s.description?.trim()) lines.push(`> **Regla:** ${s.description}`, '');
      continue;
    }
    const img = s.annotated ?? s.screenshot;
    if (!img || !numbered) continue;
    fileNo += 1;
    const name = `step-${fileNo}.${ext}`;
    imagesDir.file(name, await reencode(img, quality));
    lines.push(`## ${numbered.label}`, '');
    lines.push(`![${numbered.token || numbered.caption}](images/${name})`, '');
    if (s.description) lines.push(s.description, '');

    // Caminos alternativos (variantes) del paso.
    let vi = 0;
    for (const v of s.variants ?? []) {
      vi += 1;
      lines.push(`**${v.label || `Opción ${vi}`}**`, '');
      const vImg = v.annotated ?? v.screenshot;
      if (vImg) {
        const vName = `step-${fileNo}-v${vi}.${ext}`;
        imagesDir.file(vName, await reencode(vImg, quality));
        lines.push(`![${v.label || `Opción ${vi}`}](images/${vName})`, '');
      }
      if (v.description?.trim()) lines.push(v.description, '');
    }
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
