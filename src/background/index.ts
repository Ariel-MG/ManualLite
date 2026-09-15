import type { RuntimeMessage } from '../types';
import { countSteps, createManual } from '../db';
import {
  startRecordingState,
  stopRecordingState,
  togglePauseState,
} from '../recording/state';
import { listenToggleRecording } from './commands';
import {
  broadcastRecording,
  deleteLastStep,
  deleteStepById,
  getState,
  handleClick,
  reorderRecordingSteps,
  setState,
  updateStepCaption,
} from './session';

/**
 * Inyecta el content script en una pestaña si aún no está presente.
 * Necesario para pestañas abiertas antes de cargar/recargar la extensión.
 */
async function ensureContentScript(tabId: number): Promise<void> {
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files?.length) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
  } catch (err) {
    // Páginas no inyectables (chrome://, web store, PDFs internos, etc.)
    console.warn('[ManualLite] No se pudo inyectar en la pestaña:', err);
  }
}

async function startRecording(manualId: string, tabId?: number): Promise<void> {
  await setState(startRecordingState(manualId));
  if (tabId != null) await ensureContentScript(tabId);
  await broadcastRecording(await getState());
}

async function stopRecording(): Promise<void> {
  const idle = stopRecordingState();
  await setState(idle);
  await broadcastRecording(idle);
}

async function togglePause(): Promise<void> {
  const state = await getState();
  const next = togglePauseState(state);
  if (next === state) return;
  await setState(next);
  await broadcastRecording(next);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'START_RECORDING':
        await startRecording(message.manualId, message.tabId);
        sendResponse({ ok: true });
        break;
      case 'STOP_RECORDING':
        await stopRecording();
        sendResponse({ ok: true });
        break;
      case 'TOGGLE_PAUSE':
        await togglePause();
        sendResponse({ ok: true });
        break;
      case 'DELETE_LAST_STEP':
        await deleteLastStep();
        sendResponse({ ok: true });
        break;
      case 'DELETE_STEP':
        await deleteStepById(message.stepId);
        sendResponse({ ok: true });
        break;
      case 'REORDER_STEPS':
        await reorderRecordingSteps(message.orderedIds);
        sendResponse({ ok: true });
        break;
      case 'UPDATE_STEP_CAPTION':
        await updateStepCaption(message.stepId, message.caption);
        sendResponse({ ok: true });
        break;
      case 'GET_STATE': {
        const state = await getState();
        const stepCount = state.manualId ? await countSteps(state.manualId) : 0;
        sendResponse({
          type: 'STATE',
          recording: state.recording,
          paused: state.paused,
          manualId: state.manualId,
          stepCount,
        });
        break;
      }
      case 'CLICK_CAPTURED':
        await handleClick(message.capture, sender.tab?.windowId);
        sendResponse({ ok: true });
        break;
    }
  })();
  return true; // respuesta asíncrona
});

listenToggleRecording(chrome.commands, {
  getState,
  stopRecording,
  startFromShortcut: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const manual = await createManual('Manual sin título');
    await startRecording(manual.id, tab?.id);
  },
});
