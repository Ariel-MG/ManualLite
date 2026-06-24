import type { Manual, Step } from '../../types';
import { DEFAULT_ACCENT } from '../../types';
import { blobToDataURL, downloadBlob, safeName } from '../blob';
import { exportImageDataUrl, type ImageQuality } from '../image';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Genera un único archivo .html autocontenido (CSS + imágenes en base64). */
export async function exportHtml(
  manual: Manual,
  steps: Step[],
  quality: ImageQuality = 'medium',
): Promise<void> {
  const logo = manual.logo ? await blobToDataURL(manual.logo) : '';

  const date = new Date(manual.createdAt).toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const meta = [
    manual.author ? `Autor: ${esc(manual.author)}` : null,
    manual.version ? `Versión: ${esc(manual.version)}` : null,
    date,
  ].filter(Boolean) as string[];

  const tocItems: string[] = [];
  const bodyParts: string[] = [];
  let actionNo = 0;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const anchor = `step-${i + 1}`;

    if (s.kind === 'section') {
      tocItems.push(`<li class="toc-section"><a href="#${anchor}">${esc(s.caption)}</a></li>`);
      bodyParts.push(`<h2 class="section" id="${anchor}">${esc(s.caption)}</h2>`);
      continue;
    }
    if (s.kind === 'note') {
      if (!s.description?.trim()) continue;
      bodyParts.push(
        `<div class="note" id="${anchor}"><strong>Nota</strong> ${esc(s.description).replace(/\n/g, '<br />')}</div>`,
      );
      continue;
    }

    const img = s.annotated ?? s.screenshot;
    if (!img) continue;
    actionNo += 1;
    const dataUrl = await exportImageDataUrl(img, quality);
    tocItems.push(`<li><a href="#${anchor}">Paso ${actionNo}. ${esc(s.caption)}</a></li>`);
    bodyParts.push(`
    <section class="step" id="${anchor}">
      <h2><span class="num">${actionNo}</span> ${esc(s.caption)}</h2>
      <img src="${dataUrl}" alt="${esc(s.caption)}" loading="lazy" />
      ${s.description ? `<p class="desc">${esc(s.description).replace(/\n/g, '<br />')}</p>` : ''}
    </section>`);
  }

  const toc = tocItems.join('\n');
  const body = bodyParts.join('\n');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(manual.title)}</title>
<style>
  :root { --accent:${manual.accentColor ?? DEFAULT_ACCENT}; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,sans-serif; color:#111827; background:#f9fafb; border-top:6px solid var(--accent); }
  .cover .eyebrow { color:var(--accent); font-weight:700; letter-spacing:.18em; font-size:.8rem; margin:0 0 14px; }
  .cover .company { color:#6b7280; font-weight:700; font-size:1rem; margin:0 0 10px; }
  .cover .confidential { color:var(--accent); font-weight:700; letter-spacing:.12em; font-size:.78rem; margin:18px 0 0; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 0 20px 80px; }
  .cover { text-align:center; padding: 80px 20px 50px; }
  .cover img { max-height: 110px; margin-bottom: 24px; }
  .cover h1 { font-size: 2.4rem; margin: 0 0 10px; }
  .cover .sub { color:#6b7280; font-size:1.1rem; margin:0 0 6px; }
  .cover .date { color:#9ca3af; font-size:.9rem; }
  .toc { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px 24px; margin: 0 0 40px; }
  .toc h2 { margin:0 0 12px; font-size:1.3rem; }
  .toc ol { margin:0; padding-left: 20px; line-height:1.9; }
  .toc a { color:#111827; text-decoration:none; }
  .toc a:hover { color: var(--accent); text-decoration: underline; }
  .step { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:22px; margin-bottom: 26px; scroll-margin-top: 20px; }
  .step h2 { display:flex; align-items:center; gap:12px; font-size:1.2rem; margin:0 0 16px; }
  .step .num { flex:none; width:30px; height:30px; border-radius:50%; background:var(--accent); color:#fff; display:grid; place-items:center; font-size:.95rem; }
  .step img { width:100%; height:auto; border:1px solid #e5e7eb; border-radius:8px; display:block; }
  .step .desc { margin: 14px 0 0; color:#374151; line-height:1.6; font-size:.97rem; }
  h2.section { color:var(--accent); font-size:1.6rem; margin: 34px 0 8px; padding-bottom:8px; border-bottom:2px solid var(--accent); scroll-margin-top:20px; }
  .note { background:#fffbeb; border:1px solid #fde68a; border-left:4px solid var(--accent); border-radius:8px; padding:14px 16px; margin: 0 0 26px; color:#92400e; line-height:1.6; }
  .note strong { color:var(--accent); }
  .toc-section a { font-weight:700; }
</style>
</head>
<body>
  <div class="cover">
    ${manual.company ? `<p class="company">${esc(manual.company)}</p>` : ''}
    <p class="eyebrow">MANUAL DE USUARIO</p>
    ${logo ? `<img src="${logo}" alt="logo" />` : ''}
    <h1>${esc(manual.title)}</h1>
    ${manual.subtitle ? `<p class="sub">${esc(manual.subtitle)}</p>` : ''}
    <p class="date">${meta.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</p>
    ${manual.confidentiality ? `<p class="confidential">${esc(manual.confidentiality.toUpperCase())}</p>` : ''}
  </div>
  <div class="wrap">
    <nav class="toc">
      <h2>Índice</h2>
      <ol>
        ${toc}
      </ol>
    </nav>
    ${body}
  </div>
</body>
</html>`;

  downloadBlob(new Blob([html], { type: 'text/html' }), `${safeName(manual.title)}.html`);
}
