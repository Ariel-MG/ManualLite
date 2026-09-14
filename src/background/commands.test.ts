import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenToggleRecording } from './commands';

describe('comando toggle-recording', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con sesión activa detiene y no abre el panel', async () => {
    const listeners: Array<(command: string) => void> = [];
    const open = vi.fn();
    const stopRecording = vi.fn().mockResolvedValue(undefined);
    const startFromShortcut = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      sidePanel: { open },
      commands: {
        onCommand: {
          addListener: (fn: (command: string) => void) => {
            listeners.push(fn);
          },
        },
      },
    });

    listenToggleRecording(chrome.commands, {
      getState: async () => ({ recording: true, paused: false, manualId: 'm1' }),
      stopRecording,
      startFromShortcut,
    });

    listeners[0]!('toggle-recording');

    await vi.waitFor(() => expect(stopRecording).toHaveBeenCalledTimes(1));
    expect(open).not.toHaveBeenCalled();
    expect(startFromShortcut).not.toHaveBeenCalled();
  });
});
