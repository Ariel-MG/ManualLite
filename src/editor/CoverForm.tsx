import { useEffect, useState } from 'react';
import type { Manual } from '../types';
import { DEFAULT_ACCENT } from '../types';

type EditableField =
  | 'title'
  | 'subtitle'
  | 'logo'
  | 'accentColor'
  | 'author'
  | 'version'
  | 'company'
  | 'confidentiality'
  | 'pageSize';

interface Props {
  manual: Manual;
  onChange: (patch: Partial<Pick<Manual, EditableField>>) => void;
}

const PRESET_COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#111827'];

export function CoverForm({ manual, onChange }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!manual.logo) {
      setLogoUrl(null);
      return;
    }
    const url = URL.createObjectURL(manual.logo);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [manual.logo]);

  function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onChange({ logo: file });
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        gap: 24,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={lbl}>
          Título del manual
          <input
            value={manual.title}
            onChange={(e) => onChange({ title: e.target.value })}
            style={input}
            placeholder="Manual sin título"
          />
        </label>
        <label style={lbl}>
          Subtítulo (opcional)
          <input
            value={manual.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            style={input}
            placeholder="Ej. Guía paso a paso"
          />
        </label>

        <div style={lbl}>
          Color de marca
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((c) => {
              const active = (manual.accentColor ?? DEFAULT_ACCENT).toLowerCase() === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ accentColor: c })}
                  title={c}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    cursor: 'pointer',
                    border: active ? '2px solid #111827' : '2px solid #fff',
                    boxShadow: '0 0 0 1px #e5e7eb',
                  }}
                />
              );
            })}
            <input
              type="color"
              value={manual.accentColor ?? DEFAULT_ACCENT}
              onChange={(e) => onChange({ accentColor: e.target.value })}
              title="Color personalizado"
              style={{
                width: 32,
                height: 28,
                padding: 0,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ ...lbl, marginBottom: 0 }}>Logo de portada</span>
        <div
          style={{
            height: 100,
            border: '1px dashed #d1d5db',
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: '#f9fafb',
            overflow: 'hidden',
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="logo" style={{ maxHeight: '100%', maxWidth: '100%' }} />
          ) : (
            <span style={{ color: '#9ca3af', fontSize: 12 }}>Sin logo</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label
            style={{
              ...smallBtn,
              background: '#111827',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Subir
            <input type="file" accept="image/*" onChange={onLogoPick} style={{ display: 'none' }} />
          </label>
          {manual.logo && (
            <button
              onClick={() => onChange({ logo: undefined })}
              style={{ ...smallBtn, background: '#f3f4f6', color: '#374151' }}
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: '1 1 100%', borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>METADATOS DE PORTADA</span>
        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <label style={lbl}>
            Empresa
            <input value={manual.company ?? ''} onChange={(e) => onChange({ company: e.target.value })} style={input} placeholder="Ej. Acme S.A." />
          </label>
          <label style={lbl}>
            Autor
            <input value={manual.author ?? ''} onChange={(e) => onChange({ author: e.target.value })} style={input} placeholder="Tu nombre" />
          </label>
          <label style={lbl}>
            Versión
            <input value={manual.version ?? ''} onChange={(e) => onChange({ version: e.target.value })} style={input} placeholder="Ej. 1.0" />
          </label>
          <label style={lbl}>
            Confidencialidad
            <input value={manual.confidentiality ?? ''} onChange={(e) => onChange({ confidentiality: e.target.value })} style={input} placeholder="Ej. Confidencial" />
          </label>
          <label style={lbl}>
            Tamaño de página (PDF)
            <select
              value={manual.pageSize ?? 'A4'}
              onChange={(e) => onChange({ pageSize: e.target.value as Manual['pageSize'] })}
              style={{ ...input, cursor: 'pointer', background: '#fff' }}
            >
              <option value="A4">A4</option>
              <option value="LETTER">Carta</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
};

const input: React.CSSProperties = {
  padding: '9px 11px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
};

const smallBtn: React.CSSProperties = {
  flex: 1,
  padding: '7px 10px',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
};
