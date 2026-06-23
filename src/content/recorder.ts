/**
 * Indicador flotante de "grabando" que se inyecta en la página.
 * Se oculta momentáneamente durante la captura para no salir en el screenshot.
 */
const BADGE_ID = '__manuallite_badge__';

let badge: HTMLDivElement | null = null;
let countEl: HTMLSpanElement | null = null;

function ensureBadge(): HTMLDivElement {
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
    padding: '8px 14px',
    background: 'rgba(17, 24, 39, 0.92)',
    color: '#fff',
    font: '600 13px system-ui, -apple-system, sans-serif',
    borderRadius: '9999px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
    userSelect: 'none',
  } as CSSStyleDeclaration);

  const dot = document.createElement('span');
  Object.assign(dot.style, {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#dc2626',
    boxShadow: '0 0 0 0 rgba(220,38,38,0.7)',
    animation: 'manuallite-pulse 1.4s infinite',
  } as CSSStyleDeclaration);

  const label = document.createElement('span');
  label.textContent = 'ManualLite grabando';

  countEl = document.createElement('span');
  Object.assign(countEl.style, {
    background: 'rgba(255,255,255,0.18)',
    borderRadius: '9999px',
    padding: '1px 8px',
  } as CSSStyleDeclaration);
  countEl.textContent = '0';

  const style = document.createElement('style');
  style.textContent =
    '@keyframes manuallite-pulse{0%{box-shadow:0 0 0 0 rgba(220,38,38,.7)}70%{box-shadow:0 0 0 8px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}';

  badge.append(dot, label, countEl);
  document.documentElement.append(style);
  document.body.append(badge);
  return badge;
}

export function showBadge(stepCount: number): void {
  const b = ensureBadge();
  b.style.display = 'flex';
  if (countEl) countEl.textContent = String(stepCount);
}

export function hideBadge(): void {
  if (badge) badge.style.display = 'none';
}

export function setCount(n: number): void {
  if (countEl) countEl.textContent = String(n);
}

/** Oculta el badge, ejecuta `fn` y lo restaura (para que no salga en la captura). */
export function withBadgeHidden(visibleAfter: boolean): void {
  if (!badge) return;
  badge.style.visibility = 'hidden';
  if (visibleAfter) {
    setTimeout(() => {
      if (badge) badge.style.visibility = 'visible';
    }, 450);
  }
}
