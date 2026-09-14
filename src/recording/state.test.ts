import { describe, expect, it } from 'vitest';
import {
  countAfterDeleteLast,
  lastItem,
  shouldCaptureClick,
  shortcutToggleAction,
  startRecordingState,
  stopRecordingState,
  togglePauseState,
} from './state';

describe('matriz de grabación', () => {
  it('captura el click solo si hay sesión activa y no pausada', () => {
    expect(shouldCaptureClick(true, false)).toBe(true);
    expect(shouldCaptureClick(true, true)).toBe(false);
    expect(shouldCaptureClick(false, false)).toBe(false);
  });

  it('pausar y reanudar alternan paused sin cortar la sesión', () => {
    const live = startRecordingState('m1');
    const paused = togglePauseState(live);
    expect(paused).toEqual({ recording: true, paused: true, manualId: 'm1' });
    expect(togglePauseState(paused).paused).toBe(false);
    expect(togglePauseState(stopRecordingState())).toEqual(stopRecordingState());
  });

  it('detener deja la sesión idle', () => {
    expect(stopRecordingState()).toEqual({
      recording: false,
      paused: false,
      manualId: null,
    });
  });

  it('borrar el último de tres pasos deja dos', () => {
    const steps = ['a', 'b', 'c'];
    const last = lastItem(steps);
    expect(last).toBe('c');
    expect(countAfterDeleteLast(steps.length)).toBe(2);
    expect(countAfterDeleteLast(0)).toBe(0);
  });

  it('el atajo inicia si está idle y detiene aunque el panel esté cerrado', () => {
    expect(shortcutToggleAction(false)).toBe('start');
    expect(shortcutToggleAction(true)).toBe('stop');
  });
});
