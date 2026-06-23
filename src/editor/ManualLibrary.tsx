import { useEffect, useState } from 'react';
import type { Manual } from '../types';
import { deleteManual, duplicateManual, listManuals, updateManual } from '../db';

interface Props {
  onOpen: (id: string) => void;
}

export function ManualLibrary({ onOpen }: Props) {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  async function refresh() {
    setManuals(await listManuals());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startRename(m: Manual) {
    setEditingId(m.id);
    setDraftTitle(m.title);
  }

  async function commitRename(id: string) {
    const title = draftTitle.trim() || 'Manual sin título';
    await updateManual(id, { title });
    setEditingId(null);
    await refresh();
  }

  async function duplicate(id: string) {
    await duplicateManual(id);
    await refresh();
  }

  async function remove(m: Manual) {
    if (!confirm(`¿Borrar "${m.title}"? Esta acción no se puede deshacer.`)) return;
    await deleteManual(m.id);
    await refresh();
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px 80px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#dc2626',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
          }}
        >
          M
        </div>
        <strong style={{ fontSize: 18 }}>ManualLite</strong>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>
          {manuals.length} {manuals.length === 1 ? 'manual' : 'manuales'}
        </span>
      </header>

      {manuals.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px dashed #d1d5db',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          No hay manuales todavía. Abre el popup de ManualLite en una página web y pulsa
          <strong> Iniciar grabación</strong>.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {manuals.map((m) => (
            <li
              key={m.id}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === m.id ? (
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => commitRename(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(m.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                  />
                ) : (
                  <button
                    onClick={() => onOpen(m.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#111827',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {m.title}
                  </button>
                )}
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  Actualizado {new Date(m.updatedAt).toLocaleString('es')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onOpen(m.id)} style={action('#111827', '#fff')}>
                  Abrir
                </button>
                <button onClick={() => startRename(m)} style={action('#f3f4f6', '#374151')}>
                  Renombrar
                </button>
                <button onClick={() => duplicate(m.id)} style={action('#f3f4f6', '#374151')}>
                  Duplicar
                </button>
                <button onClick={() => remove(m)} style={action('#fef2f2', '#dc2626')}>
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function action(bg: string, color: string): React.CSSProperties {
  return {
    padding: '7px 11px',
    background: bg,
    color,
    border: 'none',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
