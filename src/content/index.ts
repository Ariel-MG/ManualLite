import type { ClickCapture, ClickedElement, RuntimeMessage } from '../types';
import { extractElementText } from '../lib/caption';
import { shouldCaptureClick } from '../recording/state';

// Evita doble registro si el script se inyecta dos veces (manifest + on-demand).
declare global {
  interface Window {
    __manualLiteInjected?: boolean;
  }
}

let recording = false;
let paused = false;

const INTERACTIVE = 'a, button, input, textarea, select, label, [role], [onclick]';

function sendBg(msg: RuntimeMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

/** Sube por el árbol hasta un elemento "interactivo" representativo. */
function resolveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(INTERACTIVE) ?? target;
}

function describeElement(el: Element): ClickedElement {
  return {
    tag: el.tagName.toLowerCase(),
    text: extractElementText(el),
    role: el.getAttribute('role') ?? undefined,
  };
}

function onPointerDown(event: PointerEvent): void {
  if (!shouldCaptureClick(recording, paused)) return;
  const el = resolveTarget(event.target);
  if (!el) return;

  const capture: ClickCapture = {
    click: { x: event.clientX, y: event.clientY },
    element: describeElement(el),
    url: location.href,
    dpr: window.devicePixelRatio || 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };

  sendBg({ type: 'CLICK_CAPTURED', capture });
}

function applyState(isRecording: boolean, isPaused: boolean): void {
  recording = isRecording;
  paused = isPaused;
}

function init(): void {
  if (window.__manualLiteInjected) return;
  window.__manualLiteInjected = true;

  chrome.runtime
    .sendMessage({ type: 'GET_STATE' } satisfies RuntimeMessage)
    .then((res: { recording: boolean; paused: boolean } | undefined) => {
      if (res) applyState(res.recording, res.paused ?? false);
    })
    .catch(() => {});

  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === 'RECORDING_CHANGED') {
      applyState(message.recording, message.paused);
    }
  });

  // Capture phase: registra el click antes de que la página reaccione/navegue.
  window.addEventListener('pointerdown', onPointerDown, { capture: true });
}

init();
