import type { Manual, Step } from '../../types';
import { blobToDataURL, downloadBlob, safeName } from '../blob';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Genera un único archivo .html autocontenido (CSS + imágenes en base64). */
export async function exportHtml(manual: Manual, steps: Step[]): Promise<void> {
  const logo = manual.logo ? await blobToDataURL(manual.logo) : '';
  const images = await Promise.all(
    steps.map((s) => blobToDataURL(s.annotated ?? s.screenshot)),
  );

  const date = new Date(manual.createdAt).toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const toc = steps
    .map((s, i) => `<li><a href="#step-${i + 1}">Paso ${i + 1}. ${esc(s.caption)}</a></li>`)
    .join('\n');

  const body = steps
    .map(
      (s, i) => `
    <section class="step" id="step-${i + 1}">
      <h2><span class="num">${i + 1}</span> ${esc(s.caption)}</h2>
      <img src="${images[i]}" alt="${esc(s.caption)}" loading="lazy" />
      ${s.description ? `<p class="desc">${esc(s.description).replace(/\n/g, '<br />')}</p>` : ''}
    </section>`,
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(manual.title)}</title>
<style>
  :root { --accent:#dc2626; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,sans-serif; color:#111827; background:#f9fafb; }
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
</style>
</head>
<body>
  <div class="cover">
    ${logo ? `<img src="${logo}" alt="logo" />` : ''}
    <h1>${esc(manual.title)}</h1>
    ${manual.subtitle ? `<p class="sub">${esc(manual.subtitle)}</p>` : ''}
    <p class="date">${date}</p>
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
