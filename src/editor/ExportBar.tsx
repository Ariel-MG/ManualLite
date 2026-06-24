import { useState } from 'react';
import type { Manual, Step } from '../types';
import { QUALITY_LABELS, type ImageQuality } from '../lib/image';

interface Props {
  manual: Manual;
  steps: Step[];
}

// Exportadores cargados bajo demanda: pdfmake/jszip son pesados y no deben
// entrar en el chunk inicial del editor.
const loaders = {
  pdf: () => import('../lib/exporters/pdf').then((m) => m.exportPdf),
  html: () => import('../lib/exporters/html').then((m) => m.exportHtml),
  md: () => import('../lib/exporters/markdown').then((m) => m.exportMarkdown),
};

const QUALITY_KEY = 'manuallite.exportQuality';

export function ExportBar({ manual, steps }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [quality, setQuality] = useState<ImageQuality>(
    () => (localStorage.getItem(QUALITY_KEY) as ImageQuality) || 'medium',
  );
  const disabled = steps.length === 0;

  function changeQuality(q: ImageQuality) {
    setQuality(q);
    localStorage.setItem(QUALITY_KEY, q);
  }

  async function run(kind: 'pdf' | 'html' | 'md') {
    setBusy(kind);
    try {
      const exporter = await loaders[kind]();
      await exporter(manual, steps, quality);
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar: ' + (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select
        value={quality}
        onChange={(e) => changeQuality(e.target.value as ImageQuality)}
        title="Calidad/compresión de las imágenes"
        style={{
          padding: '8px 8px',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          fontSize: 12,
          background: '#fff',
          color: '#374151',
          cursor: 'pointer',
        }}
      >
        {(Object.keys(QUALITY_LABELS) as ImageQuality[]).map((q) => (
          <option key={q} value={q}>
            {QUALITY_LABELS[q]}
          </option>
        ))}
      </select>
      <button
        disabled={disabled || busy !== null}
        onClick={() => run('pdf')}
        style={btn('#dc2626')}
      >
        {busy === 'pdf' ? 'Generando…' : '⬇ PDF'}
      </button>
      <button
        disabled={disabled || busy !== null}
        onClick={() => run('html')}
        style={btn('#111827')}
      >
        {busy === 'html' ? 'Generando…' : '⬇ HTML'}
      </button>
      <button
        disabled={disabled || busy !== null}
        onClick={() => run('md')}
        style={btn('#374151')}
      >
        {busy === 'md' ? 'Generando…' : '⬇ Markdown'}
      </button>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    padding: '9px 14px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 1,
  };
}
