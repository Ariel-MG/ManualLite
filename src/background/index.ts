import type { ClickCapture, RuntimeMessage } from '../types';
import { addStep, countSteps } from '../db';
import { annotateScreenshot } from '../lib/annotate';
import { buildCaption } from '../lib/caption';

interface RecState {
  recording: boolean;
  manualId: string | null;
}

const DEFAULT_STATE: RecState = { recording: false, manualId: null };

async function getState(): Promise<RecState> {
  const { rec } = await chrome.storage.session.get('rec');
  return (rec as RecState) ?? DEFAULT_STATE;
}

async function setState(state: RecState): Promise<void> {
  await chrome.storage.session.set({ rec: state });
}

/** Avisa a todas las pestañas que cambió el estado de grabación. */
async function broadcastRecording(state: RecState): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const msg: RuntimeMessage = {
    type: 'RECORDING_CHANGED',
    recording: state.recording,
    manualId: state.manualId,
  };
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {
        /* pestañas sin content script (chrome://, store, etc.) */
      });
    }
  }
}

async function handleClick(
  capture: ClickCapture,
  windowId: number | undefined,
): Promise<void> {
  const state = await getState();
  if (!state.recording || !state.manualId) return;

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

  const stepNumber = (await countSteps(state.manualId)) + 1;
  const { blob: annotated, width, height } = await annotateScreenshot(
    screenshot,
    clickOnImage,
    stepNumber,
  );

  await addStep({
    manualId: state.manualId,
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
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'START_RECORDING': {
        const next: RecState = { recording: true, manualId: message.manualId };
        await setState(next);
        await broadcastRecording(next);
        sendResponse({ ok: true });
        break;
      }
      case 'STOP_RECORDING': {
        await setState(DEFAULT_STATE);
        await broadcastRecording(DEFAULT_STATE);
        sendResponse({ ok: true });
        break;
      }
      case 'GET_STATE': {
        const state = await getState();
        const stepCount = state.manualId ? await countSteps(state.manualId) : 0;
        sendResponse({
          type: 'STATE',
          recording: state.recording,
          manualId: state.manualId,
          stepCount,
        });
        break;
      }
      case 'CLICK_CAPTURED': {
        await handleClick(message.capture, sender.tab?.windowId);
        sendResponse({ ok: true });
        break;
      }
    }
  })();
  return true; // respuesta asíncrona
});
