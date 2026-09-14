import { useEffect, useState } from 'react';
import type { RuntimeMessage } from '../types';

interface PanelState {
  recording: boolean;
  paused: boolean;
  manualId: string | null;
  stepCount: number;
}

const IDLE: PanelState = {
  recording: false,
  paused: false,
  manualId: null,
  stepCount: 0,
};

function sendBg(msg: RuntimeMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

function requestState(): Promise<PanelState | undefined> {
  const send = () =>
    chrome.runtime.sendMessage({ type: 'GET_STATE' } satisfies RuntimeMessage) as Promise<
      PanelState | undefined
    >;
  return send().catch(() => send());
}

export function SidePanel() {
  const [state, setState] = useState<PanelState>(IDLE);

  useEffect(() => {
    let cancelled = false;
    let nextSeq = 0;
    let appliedSeq = 0;

    function apply(res: Partial<PanelState> | undefined, seq: number): void {
      if (cancelled || !res) return;
      if (seq < appliedSeq) return;
      appliedSeq = seq;
      setState({
        recording: res.recording ?? false,
        paused: res.paused ?? false,
        manualId: res.manualId ?? null,
        stepCount: res.stepCount ?? 0,
      });
    }

    function fetchState(): void {
      const seq = ++nextSeq;
      requestState()
        .then((res) => apply(res, seq))
        .catch(() => {});
    }

    fetchState();

    const onMessage = (message: RuntimeMessage) => {
      if (message.type === 'RECORDING_CHANGED') {
        apply(message, ++nextSeq);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);

    const onStorage = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'session' || !changes.rec) return;
      fetchState();
    };
    chrome.storage.onChanged.addListener(onStorage);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, []);

  const live = state.recording;
  const statusLabel = !live ? 'Sin grabación' : state.paused ? 'En pausa' : 'Grabando';
  const capturedLabel = state.stepCount === 1 ? 'paso capturado' : 'pasos capturados';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        gap: 16,
      }}
    >
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: live && !state.paused ? '#fef2f2' : '#f9fafb',
          border: `1px solid ${live && !state.paused ? '#fecaca' : '#e5e7eb'}`,
          borderRadius: 8,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: !live ? '#9ca3af' : state.paused ? '#9ca3af' : '#dc2626',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>{statusLabel}</span>
      </div>

      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: '#111827' }}>
          {state.stepCount}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>{capturedLabel}</div>
      </div>

      {live ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
            Cada click en la página crea un paso con su captura. Los controles viven aquí, fuera
            del viewport.
          </p>
          <button
            type="button"
            onClick={() => sendBg({ type: 'TOGGLE_PAUSE' })}
            style={btn('#111827')}
          >
            {state.paused ? '▶ Reanudar' : '⏸ Pausar'}
          </button>
          <button
            type="button"
            onClick={() => sendBg({ type: 'DELETE_LAST_STEP' })}
            disabled={state.stepCount === 0}
            title="Borrar último paso"
            style={{
              ...btn('transparent'),
              color: '#111827',
              border: '1px solid #d1d5db',
              opacity: state.stepCount === 0 ? 0.5 : 1,
            }}
          >
            ↶ Borrar último
          </button>
          <button type="button" onClick={() => sendBg({ type: 'STOP_RECORDING' })} style={btn('#dc2626')}>
            ■ Detener
          </button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
          No hay grabación activa. Inicia o reanuda desde el popup. Si el panel está cerrado, el
          atajo de grabación sigue iniciando y deteniendo la sesión.
        </p>
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
