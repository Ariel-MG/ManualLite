import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClickCapture } from '../types';
import { addStep, countSteps, deleteStep, getSteps } from '../db';
import { deleteLastStep, handleClick } from './session';

vi.mock('../db', () => ({
  addStep: vi.fn(),
  countSteps: vi.fn(),
  deleteStep: vi.fn(),
  getSteps: vi.fn(),
}));

vi.mock('../lib/annotate', () => ({
  annotateScreenshot: vi.fn(async () => ({ blob: new Blob(['ann']), width: 8, height: 8 })),
}));

const rec = { recording: true, paused: false, manualId: 'm1' };

function installChrome() {
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const sendTab = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', {
    storage: {
      session: {
        get: vi.fn().mockResolvedValue({ rec }),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: sendTab,
      captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,aaa'),
    },
    windows: { WINDOW_ID_CURRENT: -2 },
    runtime: { sendMessage },
  });
  return { sendMessage };
}

function recordingChanged(sendMessage: ReturnType<typeof vi.fn>) {
  return sendMessage.mock.calls
    .map((c) => c[0])
    .find((msg) => msg && msg.type === 'RECORDING_CHANGED');
}

describe('broadcast a páginas de extensión', () => {
  beforeEach(() => {
    vi.mocked(getSteps).mockReset();
    vi.mocked(deleteStep).mockReset();
    vi.mocked(countSteps).mockReset();
    vi.mocked(addStep).mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['png']) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DELETE_LAST_STEP con tres pasos borra el último id y avisa stepCount 2', async () => {
    const { sendMessage } = installChrome();
    vi.mocked(getSteps).mockResolvedValue([
      { id: 's1' },
      { id: 's2' },
      { id: 's3' },
    ] as Awaited<ReturnType<typeof getSteps>>);
    vi.mocked(deleteStep).mockResolvedValue(undefined);
    vi.mocked(countSteps).mockResolvedValue(2);

    await deleteLastStep();

    expect(deleteStep).toHaveBeenCalledWith('s3');
    expect(recordingChanged(sendMessage)).toEqual({
      type: 'RECORDING_CHANGED',
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 2,
    });
  });

  it('capturar un click publica un conteo actualizado', async () => {
    const { sendMessage } = installChrome();
    vi.mocked(addStep).mockResolvedValue({ id: 's4' } as Awaited<ReturnType<typeof addStep>>);
    vi.mocked(countSteps).mockResolvedValue(4);

    const capture: ClickCapture = {
      click: { x: 10, y: 20 },
      element: { tag: 'button', text: 'OK' },
      url: 'https://example.com',
      dpr: 1,
      viewport: { width: 800, height: 600 },
    };

    await handleClick(capture, 1);

    expect(recordingChanged(sendMessage)).toEqual({
      type: 'RECORDING_CHANGED',
      recording: true,
      paused: false,
      manualId: 'm1',
      stepCount: 4,
    });
  });
});
