export interface RecState {
  recording: boolean;
  paused: boolean;
  manualId: string | null;
}

export const DEFAULT_STATE: RecState = { recording: false, paused: false, manualId: null };

export function startRecordingState(manualId: string): RecState {
  return { recording: true, paused: false, manualId };
}

export function stopRecordingState(): RecState {
  return { ...DEFAULT_STATE };
}

export function togglePauseState(state: RecState): RecState {
  if (!state.recording) return state;
  return { ...state, paused: !state.paused };
}

/** El atajo siempre alterna la sesión; no depende de que el panel esté abierto. */
export function shortcutToggleAction(recording: boolean): 'start' | 'stop' {
  return recording ? 'stop' : 'start';
}

export function shouldCaptureClick(recording: boolean, paused: boolean): boolean {
  return recording && !paused;
}

export function lastItem<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

export function countAfterDeleteLast(count: number): number {
  return Math.max(0, count - 1);
}
