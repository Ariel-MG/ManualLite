/**
 * Indicador flotante de "grabando" con controles (pausa, borrar último, detener).
 * Se oculta momentáneamente durante la captura para no salir en el screenshot.
 */
export const BADGE_ID = '__manuallite_badge__';

export interface BadgeState {
  paused: boolean;
  count: number;
}

export interface BadgeHandlers {
  onTogglePause: () => void;
  onDeleteLast: () => void;
  onStop: () => void;
}

let badge: HTMLDivElement | null = null;
let dotEl: HTMLSpanElement | null = null;
let labelEl: HTMLSpanElement | null = null;
let countEl: HTMLSpanElement | null = null;
let pauseBtn: HTMLButtonElement | null = null;

function ctrlBtn(text: string, title: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.title = title;
  Object.assign(b.style, {
    border: 'none',
    background: 'rgba(255,255,255,0.16)',
    color: '#fff',
    borderRadius: '6px',
    padding: '3px 8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    font: '600 12px system-ui, -apple-system, sans-serif',
  } as CSSStyleDeclaration);
  return b;
}

function ensureBadge(handlers: BadgeHandlers): HTMLDivElement {
  if (badge && document.body.contains(badge)) return badge;

  badge = document.createElement('div');
  badge.id = BADGE_ID;
  Object.assign(badge.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(17, 24, 39, 0.92)',
    color: '#fff',
    font: '600 13px system-ui, -apple-system, sans-serif',
    borderRadius: '9999px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    userSelect: 'none',
  } as CSSStyleDeclaration);

  dotEl = document.createElement('span');
  Object.assign(dotEl.style, {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#dc2626',
    animation: 'manuallite-pulse 1.4s infinite',
  } as CSSStyleDeclaration);

  labelEl = document.createElement('span');
  labelEl.textContent = 'Grabando';

  countEl = document.createElement('span');
  Object.assign(countEl.style, {
    background: 'rgba(255,255,255,0.18)',
    borderRadius: '9999px',
    padding: '1px 8px',
  } as CSSStyleDeclaration);
  countEl.textContent = '0';

  pauseBtn = ctrlBtn('⏸', 'Pausar/Reanudar');
  pauseBtn.addEventListener('click', handlers.onTogglePause);

  const delBtn = ctrlBtn('↶', 'Borrar último paso');
  delBtn.addEventListener('click', handlers.onDeleteLast);

  const stopBtn = ctrlBtn('■ Detener', 'Detener grabación');
  Object.assign(stopBtn.style, { background: '#dc2626' } as CSSStyleDeclaration);
  stopBtn.addEventListener('click', handlers.onStop);

  const style = document.createElement('style');
  style.textContent =
    '@keyframes manuallite-pulse{0%{box-shadow:0 0 0 0 rgba(220,38,38,.7)}70%{box-shadow:0 0 0 8px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}';

  badge.append(dotEl, labelEl, countEl, pauseBtn, delBtn, stopBtn);
  document.documentElement.append(style);
  document.body.append(badge);
  return badge;
}

export function renderBadge(state: BadgeState, handlers: BadgeHandlers): void {
  const b = ensureBadge(handlers);
  b.style.display = 'flex';
  b.style.visibility = 'visible';
  if (countEl) countEl.textContent = String(state.count);
  if (labelEl) labelEl.textContent = state.paused ? 'En pausa' : 'Grabando';
  if (pauseBtn) pauseBtn.textContent = state.paused ? '▶' : '⏸';
  if (dotEl) {
    dotEl.style.background = state.paused ? '#9ca3af' : '#dc2626';
    dotEl.style.animation = state.paused ? 'none' : 'manuallite-pulse 1.4s infinite';
  }
}

export function hideBadge(): void {
  if (badge) badge.style.display = 'none';
}

export function setCount(n: number): void {
  if (countEl) countEl.textContent = String(n);
}

/** Oculta el badge un instante para que no aparezca en la captura. */
export function withBadgeHidden(visibleAfter: boolean): void {
  if (!badge) return;
  badge.style.visibility = 'hidden';
  if (visibleAfter) {
    setTimeout(() => {
      if (badge) badge.style.visibility = 'visible';
    }, 450);
  }
}
