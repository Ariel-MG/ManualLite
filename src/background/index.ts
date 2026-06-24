import type { ClickCapture, RuntimeMessage } from '../types';
import { addStep, countSteps, createManual, deleteStep, getSteps } from '../db';
import { annotateScreenshot } from '../lib/annotate';
import { buildCaption } from '../lib/caption';

interface RecState {
  recording: boolean;
  paused: boolean;
  manualId: string | null;
}

const DEFAULT_STATE: RecState = { recording: false, paused: false, manualId: null };

async function getState(): Promise<RecState> {
  const { rec } = await chrome.storage.session.get('rec');
  return (rec as RecState) ?? DEFAULT_STATE;
}

async function setState(state: RecState): Promise<void> {
  await chrome.storage.session.set({ rec: state });
}

/** Avisa a todas las pestañas que cambió el estado de grabación. */
async function broadcastRecording(state: RecState): Promise<void> {
  const stepCount = state.manualId ? await countSteps(state.manualId) : 0;
  const msg: RuntimeMessage = {
    type: 'RECORDING_CHANGED',
    recording: state.recording,
    paused: state.paused,
    manualId: state.manualId,
    stepCount,
  };
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {
        /* pestañas sin content script (chrome://, store, etc.) */
      });
    }
  }
}

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
  await setState({ recording: true, paused: false, manualId });
  if (tabId != null) await ensureContentScript(tabId);
  await broadcastRecording(await getState());
}

async function stopRecording(): Promise<void> {
  await setState(DEFAULT_STATE);
  await broadcastRecording(DEFAULT_STATE);
}

async function togglePause(): Promise<void> {
  const state = await getState();
  if (!state.recording) return;
  const next = { ...state, paused: !state.paused };
  await setState(next);
  await broadcastRecording(next);
}

async function deleteLastStep(): Promise<void> {
  const state = await getState();
  if (!state.manualId) return;
  const steps = await getSteps(state.manualId);
  const last = steps[steps.length - 1];
  if (last) await deleteStep(last.id);
  await broadcastRecording(await getState());
}

async function handleClick(capture: ClickCapture, windowId: number | undefined): Promise<void> {
  const state = await getState();
  if (!state.recording || state.paused || !state.manualId) return;

  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId ?? chrome.windows.WINDOW_ID_CURRENT, {
      format: 'png',
    });
  } catch (err) {
    // Páginas no capturables (chrome://, web store, PDFs internos, etc.)
    console.warn('[ManualLite] No se pudo capturar la pestaña:', err);
    return;
  }

  const screenshot = await (await fetch(dataUrl)).blob();

  // El click viene en px CSS; la captura está en px de dispositivo.
  const clickOnImage = {
    x: capture.click.x * capture.dpr,
    y: capture.click.y * capture.dpr,
  };

  const { blob: annotated, width, height } = await annotateScreenshot(screenshot, clickOnImage);

  await addStep({
    manualId: state.manualId,
    kind: 'action',
    screenshot,
    annotated,
    width,
    height,
    click: capture.click,
    clickOnImage,
    element: capture.element,
    caption: buildCaption(capture.element),
    url: capture.url,
  });

  // Refresca el contador del badge en la pestaña.
  await broadcastRecording(await getState());
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

// Atajo de teclado: alterna iniciar/detener grabación.
chrome.commands?.onCommand.addListener((command) => {
  if (command !== 'toggle-recording') return;
  (async () => {
    const state = await getState();
    if (state.recording) {
      await stopRecording();
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const manual = await createManual('Manual sin título');
    await startRecording(manual.id, tab?.id);
  })();
});
