/**
 * Exporta un .manuallite.json a PDF con el mismo motor que la extensión.
 *
 *   bun run scripts/export-pdf.ts <entrada.manuallite.json> [salida.pdf]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pdfMake from 'pdfmake/build/pdfmake';
import { buildPdfDoc } from '../src/lib/exporters/pdf';
import { safeName } from '../src/lib/blob';

// Las fuentes las asigna `pdf.ts` al importar; aquí no se toca el VFS.

const input = process.argv[2];
if (!input) {
  console.error('Uso: bun run scripts/export-pdf.ts <entrada.manuallite.json> [salida.pdf]');
  process.exit(1);
}

const project = JSON.parse(readFileSync(resolve(input), 'utf8'));
if (project.app !== 'ManualLite' || !Array.isArray(project.steps)) {
  console.error('El archivo no es un proyecto ManualLite válido.');
  process.exit(1);
}

const manual = {
  id: 'cli',
  title: project.manual.title,
  subtitle: project.manual.subtitle,
  accentColor: project.manual.accentColor,
  author: project.manual.author,
  version: project.manual.version,
  company: project.manual.company,
  confidentiality: project.manual.confidentiality,
  pageSize: project.manual.pageSize,
  createdAt: project.manual.createdAt ?? Date.now(),
  updatedAt: Date.now(),
  logo: project.manual.logo,
};

const doc = await buildPdfDoc(manual, project.steps, 'png');
const out =
  process.argv[3] ??
  resolve(input.replace(/\.manuallite\.json$/i, '.pdf') || `${safeName(manual.title)}.pdf`);

const pdf = pdfMake.createPdf(doc);
const buffer: Buffer = await new Promise((resolvePdf, reject) => {
  pdf.getBuffer((buf: Uint8Array) => {
    if (!buf) reject(new Error('pdfmake no devolvió buffer'));
    else resolvePdf(Buffer.from(buf));
  });
});
writeFileSync(out, buffer);
console.log(`PDF escrito en: ${out}`);
