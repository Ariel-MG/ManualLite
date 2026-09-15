import type { ClickCapture, RuntimeMessage } from '../types';
import { addStep, countSteps, deleteStep, getSteps, reorderSteps, updateStep } from '../db';
import { annotateScreenshot } from '../lib/annotate';
import { buildCaption } from '../lib/caption';
import {
  DEFAULT_STATE,
  lastItem,
  shouldCaptureClick,
  type RecState,
} from '../recording/state';

export async function getState(): Promise<RecState> {
  const { rec } = await chrome.storage.session.get('rec');
  return (rec as RecState) ?? DEFAULT_STATE;
}

export async function setState(state: RecState): Promise<void> {
  await chrome.storage.session.set({ rec: state });
}

/** Avisa a pestañas (content scripts) y páginas de extensión (side panel, popup). */
export async function broadcastRecording(state: RecState): Promise<void> {
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
  chrome.runtime.sendMessage(msg).catch(() => {
    /* panel/popup cerrados: nadie escuchando */
  });
}

export async function deleteLastStep(): Promise<void> {
  const state = await getState();
  if (!state.manualId) return;
  const last = lastItem(await getSteps(state.manualId));
  if (last) await deleteStep(last.id);
  await broadcastRecording(await getState());
}

export async function deleteStepById(stepId: string): Promise<void> {
  const state = await getState();
  if (!state.manualId) return;
  const match = (await getSteps(state.manualId)).find((s) => s.id === stepId);
  if (!match) return;
  await deleteStep(stepId);
  await broadcastRecording(await getState());
}

export async function reorderRecordingSteps(orderedIds: string[]): Promise<void> {
  const state = await getState();
  if (!state.manualId || orderedIds.length === 0) return;
  await reorderSteps(state.manualId, orderedIds);
  await broadcastRecording(await getState());
}

export async function updateStepCaption(stepId: string, caption: string): Promise<void> {
  const state = await getState();
  if (!state.manualId) return;
  const match = (await getSteps(state.manualId)).find((s) => s.id === stepId);
  if (!match) return;
  await updateStep(stepId, { caption });
  await broadcastRecording(await getState());
}

export async function handleClick(
  capture: ClickCapture,
  windowId: number | undefined,
): Promise<void> {
  const state = await getState();
  if (!shouldCaptureClick(state.recording, state.paused) || !state.manualId) return;

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

  // Refresca el contador en el panel y en los content scripts.
  await broadcastRecording(await getState());
}
