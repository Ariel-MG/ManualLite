import { useEffect, useState } from 'react';
import type { RuntimeMessage } from '../types';
import { createManual, listManuals } from '../db';
import type { Manual } from '../types';

interface State {
  recording: boolean;
  manualId: string | null;
  stepCount: number;
}

function openEditor(manualId: string): void {
  const url = chrome.runtime.getURL(`src/editor/index.html?id=${manualId}`);
  chrome.tabs.create({ url });
}

function openLibrary(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/editor/index.html') });
}

export function Popup() {
  const [state, setState] = useState<State>({
    recording: false,
    manualId: null,
    stepCount: 0,
  });
  const [title, setTitle] = useState('Manual sin título');
  const [recent, setRecent] = useState<Manual[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = (await chrome.runtime.sendMessage({
      type: 'GET_STATE',
    } satisfies RuntimeMessage)) as State | undefined;
    if (res) setState(res);
    setRecent(await listManuals());
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, []);

  async function start() {
    setBusy(true);
    const manual = await createManual(title.trim() || 'Manual sin título');
    await chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      manualId: manual.id,
    } satisfies RuntimeMessage);
    await refresh();
    setBusy(false);
  }

  async function stop() {
    setBusy(true);
    const finishedId = state.manualId;
    await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' } satisfies RuntimeMessage);
    await refresh();
    setBusy(false);
    if (finishedId) openEditor(finishedId);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#dc2626',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          S
        </div>
        <strong style={{ fontSize: 15 }}>ManualLite</strong>
      </header>

      {state.recording ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#dc2626',
              }}
            />
            <span style={{ fontWeight: 600 }}>Grabando…</span>
            <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
              {state.stepCount} {state.stepCount === 1 ? 'paso' : 'pasos'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
            Cada click en la página crea un paso con su captura.
          </p>
          <button onClick={stop} disabled={busy} style={btn('#111827')}>
            Detener y abrir editor
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
            Título del manual
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 13,
              }}
            />
          </label>
          <button onClick={start} disabled={busy} style={btn('#dc2626')}>
            ● Iniciar grabación
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>MANUALES RECIENTES</span>
            <button
              onClick={openLibrary}
              style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Ver todos →
            </button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recent.slice(0, 5).map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => openEditor(m.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    border: 'none',
                    borderRadius: 6,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#111827',
                  }}
                >
                  {m.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    padding: '10px 12px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };
}
