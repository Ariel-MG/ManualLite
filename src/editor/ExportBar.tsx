import { useState } from 'react';
import type { Manual, Step } from '../types';

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

export function ExportBar({ manual, steps }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const disabled = steps.length === 0;

  async function run(kind: 'pdf' | 'html' | 'md') {
    setBusy(kind);
    try {
      const exporter = await loaders[kind]();
      await exporter(manual, steps);
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar: ' + (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
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
