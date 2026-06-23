import type { ClickCapture, ClickedElement, RuntimeMessage } from '../types';
import { extractElementText } from '../lib/caption';
import { hideBadge, setCount, showBadge, withBadgeHidden } from './recorder';

// Evita doble registro si el script se inyecta dos veces (manifest + on-demand).
declare global {
  interface Window {
    __manualLiteInjected?: boolean;
  }
}

let recording = false;
let localCount = 0;

const INTERACTIVE = 'a, button, input, textarea, select, label, [role], [onclick]';

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
  if (!recording) return;
  const el = resolveTarget(event.target);
  if (!el) return;

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
  requestAnimationFrame(() => {
    const msg: RuntimeMessage = { type: 'CLICK_CAPTURED', capture };
    chrome.runtime.sendMessage(msg).catch(() => {});
  });

  localCount += 1;
  setCount(localCount);
}

function applyState(isRecording: boolean, stepCount: number): void {
  recording = isRecording;
  localCount = stepCount;
  if (isRecording) showBadge(stepCount);
  else hideBadge();
}

function init(): void {
  if (window.__manualLiteInjected) return;
  window.__manualLiteInjected = true;

  // Estado inicial al cargar el content script.
  chrome.runtime
    .sendMessage({ type: 'GET_STATE' } satisfies RuntimeMessage)
    .then((res: { recording: boolean; stepCount: number } | undefined) => {
      if (res) applyState(res.recording, res.stepCount ?? 0);
    })
    .catch(() => {});

  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === 'RECORDING_CHANGED') {
      applyState(message.recording, 0);
    }
  });

  // Capture phase: registra el click antes de que la página reaccione/navegue.
  window.addEventListener('pointerdown', onPointerDown, { capture: true });
}

init();
