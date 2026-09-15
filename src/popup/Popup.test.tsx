import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeMessage } from '../types';
import { Popup } from './Popup';

const createManual = vi.fn();
const listManuals = vi.fn();

vi.mock('../db', () => ({
  createManual: (...args: unknown[]) => createManual(...args),
  listManuals: (...args: unknown[]) => listManuals(...args),
}));

function pending<T>(): Promise<T> {
  return new Promise(() => {});
}

function installChrome(state?: { recording: boolean; manualId: string | null; stepCount: number }) {
  const open = vi.fn(() => pending<void>());
  const query = vi.fn(() => pending<chrome.tabs.Tab[]>());
  const rec = state ?? { recording: false, manualId: null, stepCount: 0 };
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn((msg: RuntimeMessage) => {
        if (msg.type === 'GET_STATE') {
          return Promise.resolve({
            recording: rec.recording,
            paused: false,
            manualId: rec.manualId,
            stepCount: rec.stepCount,
          });
        }
        return Promise.resolve({ ok: true });
      }),
      getURL: (path: string) => path,
    },
    tabs: { query, create: vi.fn() },
    windows: { WINDOW_ID_CURRENT: -2 },
    sidePanel: { open },
  });
  return { open, query };
}

describe('Popup abre el side panel', () => {
  beforeEach(() => {
    createManual.mockReset();
    listManuals.mockReset();
    listManuals.mockResolvedValue([]);
    createManual.mockReturnValue(pending());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('Iniciar llama sidePanel.open en el mismo turno, sin esperar otras APIs', async () => {
    const { open, query } = installChrome();

    render(<Popup />);
    fireEvent.click(await screen.findByRole('button', { name: /Iniciar grabación/ }));

    expect(open).toHaveBeenCalledWith({ windowId: -2 });
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(query.mock.invocationCallOrder[0]);
  });

  it('Reanudar llama sidePanel.open en el mismo turno, sin esperar otras APIs', async () => {
    listManuals.mockResolvedValue([
      { id: 'm1', title: 'Manual', createdAt: 1, updatedAt: 1 },
    ]);
    const { open, query } = installChrome();

    render(<Popup />);
    fireEvent.click(await screen.findByRole('button', { name: /Reanudar/ }));

    expect(open).toHaveBeenCalledWith({ windowId: -2 });
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(query.mock.invocationCallOrder[0]);
  });

  it('mientras grabas, Abrir panel llama sidePanel.open en el click', async () => {
    const { open } = installChrome({ recording: true, manualId: 'm1', stepCount: 2 });

    render(<Popup />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir panel' }));
    expect(open).toHaveBeenCalledWith({ windowId: -2 });
  });
});
