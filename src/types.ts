// Modelo de datos central. Es la fuente única para las 3 salidas (PDF/HTML/MD).

export interface ClickPoint {
  x: number; // coords relativas al viewport, en px CSS
  y: number;
}

export interface ClickedElement {
  tag: string;
  text?: string; // textContent / aria-label / alt / title (recortado)
  role?: string;
}

export interface Step {
  id: string;
  manualId: string;
  order: number;
  screenshot: Blob; // captura PNG del viewport
  annotated?: Blob; // captura con el marcador dibujado encima
  /** Tamaño en px de la imagen anotada, para mantener proporción al exportar */
  width: number;
  height: number;
  click: ClickPoint;
  /** Punto del click ya escalado a las coords reales de la imagen capturada */
  clickOnImage: ClickPoint;
  element: ClickedElement;
  caption: string; // título del paso, editable: "Haz click en «Guardar»"
  description?: string; // texto opcional bajo la imagen, editable
  url: string;
  createdAt: number;
}

export interface Manual {
  id: string;
  title: string;
  subtitle?: string;
  logo?: Blob; // logo de la portada
  accentColor?: string; // color de marca (hex), p. ej. "#dc2626"
  createdAt: number;
  updatedAt: number;
}

/** Color de acento por defecto cuando el manual no define uno. */
export const DEFAULT_ACCENT = '#dc2626';

// --- Protocolo de mensajería (content ↔ background ↔ popup) ---

/** Datos de un click capturados por el content script */
export interface ClickCapture {
  click: ClickPoint;
  element: ClickedElement;
  url: string;
  /** devicePixelRatio en el momento del click, para escalar coords sobre la imagen */
  dpr: number;
  /** dimensiones del viewport en px CSS */
  viewport: { width: number; height: number };
}

export type RuntimeMessage =
  | { type: 'START_RECORDING'; manualId: string }
  | { type: 'STOP_RECORDING' }
  | { type: 'GET_STATE' }
  | { type: 'STATE'; recording: boolean; manualId: string | null; stepCount: number }
  | { type: 'CLICK_CAPTURED'; capture: ClickCapture }
  | { type: 'RECORDING_CHANGED'; recording: boolean; manualId: string | null };
