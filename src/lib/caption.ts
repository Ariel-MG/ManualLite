import type { ClickedElement } from '../types';

/**
 * Genera un texto de paso legible a partir del elemento clickeado.
 * Heurística simple y editable después en el editor.
 */
export function buildCaption(el: ClickedElement): string {
  const label = el.text?.trim();
  const named = label ? `«${label}»` : '';

  switch (el.tag) {
    case 'a':
      return named ? `Haz click en el enlace ${named}` : 'Haz click en el enlace';
    case 'button':
      return named ? `Haz click en el botón ${named}` : 'Haz click en el botón';
    case 'input':
    case 'textarea':
      return named ? `Escribe en el campo ${named}` : 'Haz click en el campo de texto';
    case 'select':
      return named ? `Selecciona una opción en ${named}` : 'Abre el menú desplegable';
    case 'label':
      return named ? `Haz click en ${named}` : 'Haz click en la etiqueta';
    default:
      if (el.role === 'button') {
        return named ? `Haz click en el botón ${named}` : 'Haz click en el botón';
      }
      if (el.role === 'link') {
        return named ? `Haz click en el enlace ${named}` : 'Haz click en el enlace';
      }
      return named ? `Haz click en ${named}` : 'Haz click en el elemento';
  }
}

/**
 * Extrae el texto más representativo de un elemento del DOM.
 * Prioriza aria-label, luego texto visible, alt, title o placeholder.
 */
export function extractElementText(el: Element): string | undefined {
  const candidates = [
    el.getAttribute('aria-label'),
    el.getAttribute('alt'),
    el.getAttribute('title'),
    el.getAttribute('placeholder'),
    el.getAttribute('value'),
    (el as HTMLElement).innerText,
    el.textContent,
  ];
  for (const c of candidates) {
    const t = c?.replace(/\s+/g, ' ').trim();
    if (t) return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }
  return undefined;
}
