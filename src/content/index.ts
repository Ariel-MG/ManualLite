import type { ClickCapture, ClickedElement, RuntimeMessage } from '../types';
import { extractElementText } from '../lib/caption';
import { BADGE_ID, hideBadge, renderBadge, setCount, withBadgeHidden } from './recorder';

// Evita doble registro si el script se inyecta dos veces (manifest + on-demand).
declare global {
  interface Window {
    __manualLiteInjected?: boolean;
  }
}

let recording = false;
let paused = false;
let localCount = 0;

const INTERACTIVE = 'a, button, input, textarea, select, label, [role], [onclick]';

const handlers = {
  onTogglePause: () => sendBg({ type: 'TOGGLE_PAUSE' }),
  onDeleteLast: () => sendBg({ type: 'DELETE_LAST_STEP' }),
  onStop: () => sendBg({ type: 'STOP_RECORDING' }),
};

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
  if (!recording || paused) return;
  const el = resolveTarget(event.target);
  if (!el) return;
  // No capturar clicks sobre el propio badge de control.
  if (el.closest(`#${BADGE_ID}`)) return;

  // Ocultar el badge para que no aparezca en la captura.
  withBadgeHidden(true);

  const capture: ClickCapture = {
    click: { x: event.clientX, y: event.clientY },
    element: describeElement(el),
    url: location.href,
    dpr: window.devicePixelRatio || 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };

  // Pequeño respiro para que el repaint oculte el badge antes de capturar.
  requestAnimationFrame(() => sendBg({ type: 'CLICK_CAPTURED', capture }));

  localCount += 1;
  setCount(localCount);
}

function applyState(isRecording: boolean, isPaused: boolean, stepCount: number): void {
  recording = isRecording;
  paused = isPaused;
  localCount = stepCount;
  if (isRecording) renderBadge({ paused: isPaused, count: stepCount }, handlers);
  else hideBadge();
}

function init(): void {
  if (window.__manualLiteInjected) return;
  window.__manualLiteInjected = true;

  // Estado inicial al cargar el content script.
  chrome.runtime
    .sendMessage({ type: 'GET_STATE' } satisfies RuntimeMessage)
    .then((res: { recording: boolean; paused: boolean; stepCount: number } | undefined) => {
      if (res) applyState(res.recording, res.paused ?? false, res.stepCount ?? 0);
    })
    .catch(() => {});

  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === 'RECORDING_CHANGED') {
      applyState(message.recording, message.paused, message.stepCount);
    }
  });

  // Capture phase: registra el click antes de que la página reaccione/navegue.
  window.addEventListener('pointerdown', onPointerDown, { capture: true });
}

init();
