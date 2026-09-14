import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRecordingPanel } from './open';

describe('apertura del side panel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a sidePanel.open en el mismo turno, sin esperar getCurrent', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const getCurrent = vi.fn();
    vi.stubGlobal('chrome', {
      windows: { WINDOW_ID_CURRENT: -2, getCurrent },
      sidePanel: { open },
    });

    await openRecordingPanel();

    expect(open).toHaveBeenCalledWith({ windowId: -2 });
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('si open falla, no lanza: la grabación puede seguir', async () => {
    vi.stubGlobal('chrome', {
      windows: { WINDOW_ID_CURRENT: -2 },
      sidePanel: { open: vi.fn().mockRejectedValue(new Error('no gesture')) },
    });

    await expect(openRecordingPanel()).resolves.toBeUndefined();
  });

  it('si sidePanel no existe, no lanza: la grabación puede seguir', async () => {
    vi.stubGlobal('chrome', {
      windows: { WINDOW_ID_CURRENT: -2 },
    });

    await expect(openRecordingPanel()).resolves.toBeUndefined();
  });

  it('si open lanza en sincrónico, no propaga', async () => {
    vi.stubGlobal('chrome', {
      windows: { WINDOW_ID_CURRENT: -2 },
      sidePanel: {
        open: () => {
          throw new Error('no api');
        },
      },
    });

    await expect(openRecordingPanel()).resolves.toBeUndefined();
  });
});
