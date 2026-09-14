import { shortcutToggleAction, type RecState } from '../recording/state';

export interface RecordingCommandDeps {
  getState: () => Promise<RecState>;
  stopRecording: () => Promise<void>;
  startFromShortcut: () => Promise<void>;
}

export async function dispatchRecordingCommand(
  command: string,
  deps: RecordingCommandDeps,
): Promise<void> {
  if (command !== 'toggle-recording') return;
  const state = await deps.getState();
  if (shortcutToggleAction(state.recording) === 'stop') {
    await deps.stopRecording();
    return;
  }
  await deps.startFromShortcut();
}

export function listenToggleRecording(
  commands: typeof chrome.commands | undefined,
  deps: RecordingCommandDeps,
): void {
  commands?.onCommand.addListener((command) => {
    void dispatchRecordingCommand(command, deps);
  });
}
