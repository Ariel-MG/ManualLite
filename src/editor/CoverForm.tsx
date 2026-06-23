import { useEffect, useState } from 'react';
import type { Manual } from '../types';

interface Props {
  manual: Manual;
  onChange: (patch: Partial<Pick<Manual, 'title' | 'subtitle' | 'logo'>>) => void;
}

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
