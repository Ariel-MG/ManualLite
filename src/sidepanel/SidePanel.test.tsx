import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeMessage, Step } from '../types';
import { getSteps } from '../db';
import { SidePanel } from './SidePanel';

vi.mock('../db', () => ({
  getSteps: vi.fn(),
}));

interface ChromeState {
  recording: boolean;
  paused: boolean;
  manualId: string | null;
  stepCount: number;
}

function sampleSteps(n: number): Step[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    manualId: 'm1',
    order: i,
    kind: 'action' as const,
    caption: `Paso ${i + 1}`,
    screenshot: new Blob(['png'], { type: 'image/png' }),
    createdAt: i,
  }));
}

function installChrome(initial: ChromeState) {
  let state = { ...initial };
  const messageListeners: Array<(message: RuntimeMessage) => void> = [];
  const storageListeners: Array<() => void> = [];
  const sendMessage = vi.fn((msg: RuntimeMessage) => {
    if (msg.type === 'GET_STATE') {
      return Promise.resolve({ type: 'STATE', ...state });
    }
    return Promise.resolve({ ok: true });
  });

  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: (fn: (message: RuntimeMessage) => void) => {
          messageListeners.push(fn);
        },
        removeListener: (fn: (message: RuntimeMessage) => void) => {
          const i = messageListeners.indexOf(fn);
          if (i >= 0) messageListeners.splice(i, 1);
        },
      },
    },
    storage: {
      onChanged: {
        addListener: (fn: () => void) => {
          storageListeners.push(fn);
        },
        removeListener: (fn: () => void) => {
          const i = storageListeners.indexOf(fn);
          if (i >= 0) storageListeners.splice(i, 1);
        },
      },
    },
  });

  return {
    sendMessage,
    emit(message: RuntimeMessage) {
      for (const fn of messageListeners) fn(message);
    },
    setState(next: ChromeState) {
      state = { ...next };
    },
  };
}

describe('SidePanel', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {});
    vi.mocked(getSteps).mockReset();
    vi.mocked(getSteps).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra el conteo y envía pausa y detener', async () => {
    const chromeApi = installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 3,
    });

    render(<SidePanel />);

    expect(await screen.findByText('3 pasos')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Detener/ }));

    const types = chromeApi.sendMessage.mock.calls.map((c) => (c[0] as RuntimeMessage).type);
    expect(types).toContain('TOGGLE_PAUSE');
    expect(types).toContain('STOP_RECORDING');
    expect(types).not.toContain('DELETE_LAST_STEP');
  });

  it('borra un paso concreto del filmstrip', async () => {
    vi.mocked(getSteps).mockResolvedValue(sampleSteps(3));
    const chromeApi = installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 3,
    });

    render(<SidePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar paso 2' }));

    expect(chromeApi.sendMessage).toHaveBeenCalledWith({ type: 'DELETE_STEP', stepId: 's2' });
  });

  it('al borrar, el conteo pasa a dos cuando llega RECORDING_CHANGED', async () => {
    vi.mocked(getSteps).mockResolvedValue(sampleSteps(3));
    const chromeApi = installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 3,
    });

    render(<SidePanel />);
    expect(await screen.findByText('3 pasos')).toBeTruthy();

    vi.mocked(getSteps).mockResolvedValue(sampleSteps(2));
    chromeApi.emit({
      type: 'RECORDING_CHANGED',
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 2,
    });

    await waitFor(() => {
      expect(screen.getByText('2 pasos')).toBeTruthy();
    });
  });

  it('guarda el título de una línea al editarlo', async () => {
    vi.mocked(getSteps).mockResolvedValue(sampleSteps(1));
    const chromeApi = installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 1,
    });

    render(<SidePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Paso 1' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Título del paso' }), {
      target: { value: 'Clic en Guardar' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Título del paso' }));

    expect(chromeApi.sendMessage).toHaveBeenCalledWith({
      type: 'UPDATE_STEP_CAPTION',
      stepId: 's1',
      caption: 'Clic en Guardar',
    });
  });

  it('click con sesión pausada no está en el panel: el botón reanuda', async () => {
    installChrome({
      recording: true,
      paused: true,
      manualId: 'm1',
      stepCount: 1,
    });

    render(<SidePanel />);
    expect(await screen.findByText('En pausa')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reanudar/ })).toBeTruthy();
  });

  it('muestra «1 paso» en singular', async () => {
    installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 1,
    });

    render(<SidePanel />);
    expect(await screen.findByText('1 paso')).toBeTruthy();
    expect(screen.queryByText('1 pasos')).toBeNull();
  });

  it('un GET_STATE lento no pisa un RECORDING_CHANGED más nuevo', async () => {
    let resolveGet: ((value: ChromeState) => void) | undefined;
    const sendMessage = vi.fn((msg: RuntimeMessage) => {
      if (msg.type === 'GET_STATE') {
        return new Promise<ChromeState>((resolve) => {
          resolveGet = resolve;
        });
      }
      return Promise.resolve({ ok: true });
    });
    const messageListeners: Array<(message: RuntimeMessage) => void> = [];
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: (fn: (message: RuntimeMessage) => void) => {
            messageListeners.push(fn);
          },
          removeListener: (fn: (message: RuntimeMessage) => void) => {
            const i = messageListeners.indexOf(fn);
            if (i >= 0) messageListeners.splice(i, 1);
          },
        },
      },
      storage: {
        onChanged: { addListener: () => {}, removeListener: () => {} },
      },
    });

    render(<SidePanel />);
    for (const fn of messageListeners) {
      fn({
        type: 'RECORDING_CHANGED',
        recording: true,
        paused: false,
        manualId: 'm1',
        stepCount: 4,
      });
    }

    expect(await screen.findByText('4 pasos')).toBeTruthy();
    expect(screen.getByText('Grabando')).toBeTruthy();

    resolveGet?.({
      recording: false,
      paused: false,
      manualId: null,
      stepCount: 0,
    });

    await Promise.resolve();
    await waitFor(() => {
      expect(screen.getByText('4 pasos')).toBeTruthy();
      expect(screen.getByText('Grabando')).toBeTruthy();
      expect(screen.queryByText('Sin grabación')).toBeNull();
    });
  });

  it('si GET_STATE falla una vez, reintenta y muestra la sesión viva', async () => {
    let gets = 0;
    const sendMessage = vi.fn((msg: RuntimeMessage) => {
      if (msg.type === 'GET_STATE') {
        gets += 1;
        if (gets === 1) return Promise.reject(new Error('flaky'));
        return Promise.resolve({
          type: 'STATE',
          recording: true,
          paused: false,
          manualId: 'm1',
          stepCount: 2,
        });
      }
      return Promise.resolve({ ok: true });
    });
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage,
        onMessage: { addListener: () => {}, removeListener: () => {} },
      },
      storage: {
        onChanged: { addListener: () => {}, removeListener: () => {} },
      },
    });

    render(<SidePanel />);
    expect(await screen.findByText('2 pasos')).toBeTruthy();
    expect(screen.getByText('Grabando')).toBeTruthy();
    expect(gets).toBe(2);
  });

  it('desmontar el panel no envía STOP_RECORDING: la grabación sigue', async () => {
    const chromeApi = installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 1,
    });

    const view = render(<SidePanel />);
    await screen.findByText('Grabando');
    chromeApi.sendMessage.mockClear();
    view.unmount();

    const types = chromeApi.sendMessage.mock.calls.map((c) => (c[0] as RuntimeMessage).type);
    expect(types).not.toContain('STOP_RECORDING');
  });
});
