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

/**
 * Tipo de paso:
 * - 'action': capturado por click (tiene imagen).
 * - 'section': encabezado de sección (agrupa pasos, sale en el índice).
 * - 'note': nota/aviso de solo texto.
 */
export type StepKind = 'action' | 'section' | 'note';

export interface Step {
  id: string;
  manualId: string;
  order: number;
  kind: StepKind;
  caption: string; // título del paso / texto de la sección
  description?: string; // texto opcional (cuerpo de la nota o detalle del paso)
  // Campos de imagen: solo para 'action'.
  screenshot?: Blob; // captura PNG del viewport
  annotated?: Blob; // captura con el marcador dibujado encima
  /** Tamaño en px de la imagen anotada, para mantener proporción al exportar */
  width?: number;
  height?: number;
  click?: ClickPoint;
  /** Punto del click ya escalado a las coords reales de la imagen capturada */
  clickOnImage?: ClickPoint;
  element?: ClickedElement;
  url?: string;
  createdAt: number;
}

export type PageSize = 'A4' | 'LETTER';

export interface Manual {
  id: string;
  title: string;
  subtitle?: string;
  logo?: Blob; // logo de la portada
  accentColor?: string; // color de marca (hex), p. ej. "#dc2626"
  // Metadatos de portada (todos opcionales y editables por el usuario)
  author?: string;
  version?: string;
  company?: string;
  confidentiality?: string; // aviso, p. ej. "Confidencial"
  pageSize?: PageSize; // tamaño de página del PDF (por defecto A4)
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
  | { type: 'START_RECORDING'; manualId: string; tabId?: number }
  | { type: 'STOP_RECORDING' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'DELETE_LAST_STEP' }
  | { type: 'GET_STATE' }
  | { type: 'STATE'; recording: boolean; paused: boolean; manualId: string | null; stepCount: number }
  | { type: 'CLICK_CAPTURED'; capture: ClickCapture }
  | { type: 'RECORDING_CHANGED'; recording: boolean; paused: boolean; manualId: string | null; stepCount: number };
