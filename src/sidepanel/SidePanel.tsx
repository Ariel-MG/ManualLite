import { useEffect, useState } from 'react';
import type { RuntimeMessage, Step } from '../types';
import { getSteps } from '../db';
import { StepStrip } from './StepStrip';

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
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    let cancelled = false;
    let nextSeq = 0;
    let appliedSeq = 0;

    function apply(res: Partial<PanelState> | undefined, seq: number): void {
      if (cancelled || !res) return;
      if (seq < appliedSeq) return;
      appliedSeq = seq;
      const next: PanelState = {
        recording: res.recording ?? false,
        paused: res.paused ?? false,
        manualId: res.manualId ?? null,
        stepCount: res.stepCount ?? 0,
      };
      setState(next);
      if (!next.manualId) {
        setSteps([]);
        return;
      }
      getSteps(next.manualId)
        .then((list) => {
          if (!cancelled && seq === appliedSeq) setSteps(list);
        })
        .catch(() => {});
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
  const capturedLabel = state.stepCount === 1 ? 'paso' : 'pasos';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
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
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
            {state.stepCount} {capturedLabel}
          </span>
        </div>

        {live ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => sendBg({ type: 'TOGGLE_PAUSE' })}
                style={{ ...btn('#111827'), flex: 1 }}
              >
                {state.paused ? '▶ Reanudar' : '⏸ Pausar'}
              </button>
              <button
                type="button"
                onClick={() => sendBg({ type: 'STOP_RECORDING' })}
                style={{ ...btn('#dc2626'), flex: 1 }}
              >
                ■ Detener
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
              Cierra este panel si necesitas espacio; la grabación sigue. Reábrelo desde el popup.
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
            No hay grabación activa. Inicia o reanuda desde el popup. Si cierras el panel mientras
            grabas, el atajo sigue deteniendo la sesión.
          </p>
        )}
      </div>

      {live && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '0 16px 16px',
            background: '#f9fafb',
            borderTop: '1px solid #f3f4f6',
          }}
        >
          <div style={{ paddingTop: 12 }}>
            <StepStrip
              steps={steps}
              onReorder={(orderedIds) => sendBg({ type: 'REORDER_STEPS', orderedIds })}
              onCaption={(stepId, caption) => sendBg({ type: 'UPDATE_STEP_CAPTION', stepId, caption })}
              onDelete={(stepId) => sendBg({ type: 'DELETE_STEP', stepId })}
            />
          </div>
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
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}
