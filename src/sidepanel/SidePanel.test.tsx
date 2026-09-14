import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeMessage } from '../types';
import { SidePanel } from './SidePanel';

interface ChromeState {
  recording: boolean;
  paused: boolean;
  manualId: string | null;
  stepCount: number;
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
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra el conteo y envía pausa, borrar último y detener', async () => {
    const chromeApi = installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 3,
    });

    render(<SidePanel />);

    expect(await screen.findByText('3')).toBeTruthy();
    expect(screen.getByText('pasos capturados')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Borrar último/ }));
    fireEvent.click(screen.getByRole('button', { name: /Detener/ }));

    const types = chromeApi.sendMessage.mock.calls.map((c) => (c[0] as RuntimeMessage).type);
    expect(types).toContain('TOGGLE_PAUSE');
    expect(types).toContain('DELETE_LAST_STEP');
    expect(types).toContain('STOP_RECORDING');
  });

  it('al borrar el último de tres, el conteo pasa a dos cuando llega RECORDING_CHANGED', async () => {
    const chromeApi = installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 3,
    });

    render(<SidePanel />);
    expect(await screen.findByText('3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Borrar último/ }));
    chromeApi.emit({
      type: 'RECORDING_CHANGED',
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 2,
    });

    await waitFor(() => {
      expect(screen.getByText('2')).toBeTruthy();
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

  it('muestra «paso capturado» en singular cuando hay un paso', async () => {
    installChrome({
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 1,
    });

    render(<SidePanel />);
    expect(await screen.findByText('paso capturado')).toBeTruthy();
    expect(screen.queryByText('paso capturados')).toBeNull();
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

    expect(await screen.findByText('4')).toBeTruthy();
    expect(screen.getByText('Grabando')).toBeTruthy();

    resolveGet?.({
      recording: false,
      paused: false,
      manualId: null,
      stepCount: 0,
    });

    await Promise.resolve();
    await waitFor(() => {
      expect(screen.getByText('4')).toBeTruthy();
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
    expect(await screen.findByText('2')).toBeTruthy();
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
