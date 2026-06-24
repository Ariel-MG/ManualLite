import { useEffect, useRef, useState } from 'react';
import type { Step } from '../types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImagePatch {
  annotated: Blob;
  width: number;
  height: number;
}

interface Props {
  step: Step;
  onClose: () => void;
  onApply: (patch: ImagePatch) => void;
}

type Tool = 'crop' | 'blur' | 'focus' | 'annotate';
type AnnoTool = 'arrow' | 'rect' | 'text';

type Anno =
  | { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string }
  | { type: 'text'; x: number; y: number; text: string; color: string };

const MAX_DISPLAY_W = 820;

/** Dibuja una flecha de (x1,y1) a (x2,y2) con punta. */
function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lw: number): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(12, lw * 3.5);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

/** Normaliza un rect con anchos/altos posiblemente negativos. */
function norm(r: Rect): Rect {
  return {
    x: r.w < 0 ? r.x + r.w : r.x,
    y: r.h < 0 ? r.y + r.h : r.y,
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  };
}

export function StepImageEditor({ step, onClose, onApply }: Props) {
  const [imgUrl, setImgUrl] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [display, setDisplay] = useState({ w: 0, h: 0, scale: 1 });
  const [tool, setTool] = useState<Tool>('crop');
  const [crop, setCrop] = useState<Rect | null>(null);
  const [redactions, setRedactions] = useState<Rect[]>([]);
  const [redactStyle, setRedactStyle] = useState<'blur' | 'solid'>('blur');
  const [temp, setTemp] = useState<Rect | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [focusRadius, setFocusRadius] = useState(24); // % de la dimensión menor
  const [zoom, setZoom] = useState(2);
  const [annoTool, setAnnoTool] = useState<AnnoTool>('arrow');
  const [annoColor, setAnnoColor] = useState('#dc2626');
  const [annotations, setAnnotations] = useState<Anno[]>([]);
  const dragging = useRef(false);

  useEffect(() => {
    const img = step.annotated ?? step.screenshot;
    if (!img) return;
    const url = URL.createObjectURL(img);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [step]);

  function onImgLoad() {
    const natW = imgRef.current?.naturalWidth || step.width || 0;
    const natH = imgRef.current?.naturalHeight || step.height || 0;
    const w = Math.min(MAX_DISPLAY_W, natW);
    const scale = w / natW;
    setDisplay({ w, h: natH * scale, scale });
    // Centro de foco por defecto: el punto del click registrado.
    if (step.clickOnImage) {
      setFocus({ x: step.clickOnImage.x * scale, y: step.clickOnImage.y * scale });
    } else {
      setFocus({ x: w / 2, y: (natH * scale) / 2 });
    }
  }

  function pointer(e: React.PointerEvent): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(display.w, e.clientX - rect.left)),
      y: Math.max(0, Math.min(display.h, e.clientY - rect.top)),
    };
  }

  function onDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointer(e);
    if (tool === 'focus') {
      dragging.current = true;
      setFocus(p);
      return;
    }
    if (tool === 'annotate' && annoTool === 'text') {
      const text = window.prompt('Texto de la anotación:');
      if (text?.trim()) setAnnotations((prev) => [...prev, { type: 'text', x: p.x, y: p.y, text: text.trim(), color: annoColor }]);
      return;
    }
    dragging.current = true;
    setTemp({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const p = pointer(e);
    if (tool === 'focus') setFocus(p);
    else if (temp) setTemp({ ...temp, w: p.x - temp.x, h: p.y - temp.y });
  }

  function onUp() {
    dragging.current = false;
    if (tool === 'focus') return;
    if (!temp) return;

    if (tool === 'annotate') {
      const dist = Math.hypot(temp.w, temp.h);
      if (dist >= 8) {
        if (annoTool === 'arrow') {
          setAnnotations((prev) => [...prev, { type: 'arrow', x1: temp.x, y1: temp.y, x2: temp.x + temp.w, y2: temp.y + temp.h, color: annoColor }]);
        } else if (annoTool === 'rect') {
          const r = norm(temp);
          setAnnotations((prev) => [...prev, { type: 'rect', ...r, color: annoColor }]);
        }
      }
      setTemp(null);
      return;
    }

    const r = norm(temp);
    if (r.w >= 5 && r.h >= 5) {
      if (tool === 'crop') setCrop(r);
      else setRedactions((prev) => [...prev, r]);
    }
    setTemp(null);
  }

  function toNatural(r: Rect): Rect {
    const s = 1 / display.scale;
    return { x: Math.round(r.x * s), y: Math.round(r.y * s), w: Math.round(r.w * s), h: Math.round(r.h * s) };
  }

  async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  }

  async function applyCrop() {
    if (!crop) return;
    const c = toNatural(crop);
    if (c.w < 5 || c.h < 5) return;
    const canvas = document.createElement('canvas');
    canvas.width = c.w;
    canvas.height = c.h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imgRef.current!, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
    onApply({ annotated: await canvasToBlob(canvas), width: c.w, height: c.h });
  }

  async function applyRedactions() {
    if (!redactions.length) return;
    const img = imgRef.current!;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    for (const rd of redactions) {
      const r = toNatural(rd);
      if (redactStyle === 'solid') {
        ctx.fillStyle = '#111827';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
        ctx.filter = `blur(${Math.max(8, Math.min(r.w, r.h) * 0.18)}px)`;
        ctx.drawImage(canvas, 0, 0); // redibuja la imagen ya difuminada solo en la zona
        ctx.restore();
      }
    }
    ctx.filter = 'none';
    onApply({ annotated: await canvasToBlob(canvas), width: natW, height: natH });
  }

  /** Centro de foco en coordenadas naturales. */
  function focusNatural(): { x: number; y: number } {
    const s = 1 / display.scale;
    const f = focus ?? { x: display.w / 2, y: display.h / 2 };
    return { x: f.x * s, y: f.y * s };
  }

  async function applySpotlight() {
    const img = imgRef.current!;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const { x, y } = focusNatural();
    const r = (Math.min(natW, natH) * focusRadius) / 100;

    const canvas = document.createElement('canvas');
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const grd = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.6);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, natW, natH);

    onApply({ annotated: await canvasToBlob(canvas), width: natW, height: natH });
  }

  async function applyZoom() {
    const img = imgRef.current!;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const { x, y } = focusNatural();
    const cw = natW / zoom;
    const ch = natH / zoom;
    const sx = Math.max(0, Math.min(natW - cw, x - cw / 2));
    const sy = Math.max(0, Math.min(natH - ch, y - ch / 2));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cw);
    canvas.height = Math.round(ch);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
    onApply({ annotated: await canvasToBlob(canvas), width: canvas.width, height: canvas.height });
  }

  async function applyAnnotations() {
    if (!annotations.length) return;
    const img = imgRef.current!;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const s = 1 / display.scale;
    const lw = Math.max(3, Math.min(natW, natH) * 0.005);

    const canvas = document.createElement('canvas');
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    for (const a of annotations) {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      if (a.type === 'rect') {
        ctx.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s);
      } else if (a.type === 'arrow') {
        drawArrow(ctx, a.x1 * s, a.y1 * s, a.x2 * s, a.y2 * s, lw);
      } else {
        const fontSize = Math.max(16, Math.min(natW, natH) * 0.03);
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.lineWidth = fontSize * 0.18;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(a.text, a.x * s, a.y * s);
        ctx.fillStyle = a.color;
        ctx.fillText(a.text, a.x * s, a.y * s);
      }
    }
    onApply({ annotated: await canvasToBlob(canvas), width: natW, height: natH });
  }

  const tempN = temp ? norm(temp) : null;
  const canApply = tool === 'crop' ? !!crop : redactions.length > 0;
  const spotRadiusDisplay = (Math.min(display.w, display.h) * focusRadius) / 100;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>Editar imagen</strong>
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
            <button onClick={() => setTool('crop')} style={tab(tool === 'crop')}>
              ▭ Recortar
            </button>
            <button onClick={() => setTool('blur')} style={tab(tool === 'blur')}>
              ◧ Difuminar
            </button>
            <button onClick={() => setTool('focus')} style={tab(tool === 'focus')}>
              ◎ Foco
            </button>
            <button onClick={() => setTool('annotate')} style={tab(tool === 'annotate')}>
              ✎ Anotar
            </button>
          </div>
          {tool === 'annotate' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
                <button onClick={() => setAnnoTool('arrow')} style={tab(annoTool === 'arrow')}>↗ Flecha</button>
                <button onClick={() => setAnnoTool('rect')} style={tab(annoTool === 'rect')}>▭ Recuadro</button>
                <button onClick={() => setAnnoTool('text')} style={tab(annoTool === 'text')}>T Texto</button>
              </div>
              <input
                type="color"
                value={annoColor}
                onChange={(e) => setAnnoColor(e.target.value)}
                title="Color de la anotación"
                style={{ width: 30, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
              />
            </div>
          )}
          {tool === 'blur' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#374151' }}>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" checked={redactStyle === 'blur'} onChange={() => setRedactStyle('blur')} /> Difuminar
              </label>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" checked={redactStyle === 'solid'} onChange={() => setRedactStyle('solid')} /> Tapar
              </label>
            </div>
          )}
          {tool === 'focus' && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12, color: '#374151' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                Radio
                <input type="range" min={8} max={45} value={focusRadius} onChange={(e) => setFocusRadius(+e.target.value)} />
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                Zoom
                <input type="range" min={120} max={400} value={zoom * 100} onChange={(e) => setZoom(+e.target.value / 100)} />
                {zoom.toFixed(1)}×
              </label>
            </div>
          )}
          <button onClick={onClose} style={{ marginLeft: 'auto', ...iconBtn }}>
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>
          {tool === 'crop'
            ? 'Arrastra para seleccionar el área a conservar.'
            : tool === 'blur'
              ? 'Arrastra sobre cada zona sensible para ocultarla. Puedes marcar varias.'
              : tool === 'focus'
                ? 'Haz click para situar el punto de foco; ajusta radio/zoom y aplica.'
                : annoTool === 'text'
                  ? 'Haz click donde quieras colocar el texto.'
                  : 'Arrastra para dibujar la flecha o el recuadro. Puedes añadir varias.'}
        </p>

        <div style={{ display: 'grid', placeItems: 'center', background: '#f3f4f6', borderRadius: 8, padding: 12, overflow: 'auto' }}>
          <div
            ref={containerRef}
            style={{ position: 'relative', width: display.w || 'auto', height: display.h || 'auto', touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <img
              ref={imgRef}
              src={imgUrl}
              onLoad={onImgLoad}
              draggable={false}
              style={{ display: 'block', width: display.w || 'auto', userSelect: 'none' }}
              alt={step.caption}
            />

            {/* Zonas de difuminado ya marcadas */}
            {tool === 'blur' &&
              redactions.map((r, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: r.x,
                    top: r.y,
                    width: r.w,
                    height: r.h,
                    background: redactStyle === 'solid' ? 'rgba(17,24,39,0.85)' : 'rgba(17,24,39,0.35)',
                    backdropFilter: redactStyle === 'blur' ? 'blur(6px)' : undefined,
                    border: '1px solid rgba(255,255,255,0.6)',
                    pointerEvents: 'none',
                  }}
                />
              ))}

            {/* Selección de recorte ya fijada */}
            {tool === 'crop' && crop && !temp && (
              <div
                style={{
                  position: 'absolute',
                  left: crop.x,
                  top: crop.y,
                  width: crop.w,
                  height: crop.h,
                  border: '2px solid #dc2626',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Vista previa del foco */}
            {tool === 'focus' && focus && (
              <div
                style={{
                  position: 'absolute',
                  left: focus.x - spotRadiusDisplay,
                  top: focus.y - spotRadiusDisplay,
                  width: spotRadiusDisplay * 2,
                  height: spotRadiusDisplay * 2,
                  borderRadius: '50%',
                  border: '2px solid #dc2626',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Previsualización de anotaciones */}
            {tool === 'annotate' && (
              <svg
                width={display.w}
                height={display.h}
                style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
              >
                <defs>
                  {annotations.concat(temp && annoTool === 'arrow' ? [{ type: 'arrow', x1: temp.x, y1: temp.y, x2: temp.x + temp.w, y2: temp.y + temp.h, color: annoColor }] : []).map((a, i) =>
                    a.type === 'arrow' ? (
                      <marker key={i} id={`ah-${i}`} markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
                        <path d="M0,0 L7,3 L0,6 Z" fill={a.color} />
                      </marker>
                    ) : null,
                  )}
                </defs>
                {annotations.map((a, i) => {
                  if (a.type === 'arrow')
                    return <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.color} strokeWidth={3} markerEnd={`url(#ah-${i})`} />;
                  if (a.type === 'rect')
                    return <rect key={i} x={a.x} y={a.y} width={a.w} height={a.h} fill="none" stroke={a.color} strokeWidth={3} />;
                  return (
                    <text key={i} x={a.x} y={a.y + 14} fill={a.color} stroke="#fff" strokeWidth={3} paintOrder="stroke" fontSize={16} fontWeight={700}>
                      {a.text}
                    </text>
                  );
                })}
                {temp && annoTool === 'arrow' && (
                  <line x1={temp.x} y1={temp.y} x2={temp.x + temp.w} y2={temp.y + temp.h} stroke={annoColor} strokeWidth={3} markerEnd={`url(#ah-${annotations.length})`} />
                )}
                {temp && annoTool === 'rect' && tempN && (
                  <rect x={tempN.x} y={tempN.y} width={tempN.w} height={tempN.h} fill="none" stroke={annoColor} strokeWidth={3} strokeDasharray="4 3" />
                )}
              </svg>
            )}

            {/* Rectángulo en curso de arrastre */}
            {tool !== 'focus' && tool !== 'annotate' && tempN && tempN.w > 0 && tempN.h > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: tempN.x,
                  top: tempN.y,
                  width: tempN.w,
                  height: tempN.h,
                  border: `2px solid ${tool === 'crop' ? '#dc2626' : '#2563eb'}`,
                  background: tool === 'blur' ? 'rgba(37,99,235,0.15)' : undefined,
                  boxShadow: tool === 'crop' ? '0 0 0 9999px rgba(0,0,0,0.45)' : undefined,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          {tool === 'blur' && redactions.length > 0 && (
            <>
              <button onClick={() => setRedactions((p) => p.slice(0, -1))} style={btn('#f3f4f6', '#374151')}>
                Deshacer última
              </button>
              <button onClick={() => setRedactions([])} style={btn('#f3f4f6', '#374151')}>
                Limpiar ({redactions.length})
              </button>
            </>
          )}
          {tool === 'crop' && crop && (
            <button onClick={() => setCrop(null)} style={btn('#f3f4f6', '#374151')}>
              Limpiar selección
            </button>
          )}
          {tool === 'annotate' && annotations.length > 0 && (
            <>
              <button onClick={() => setAnnotations((p) => p.slice(0, -1))} style={btn('#f3f4f6', '#374151')}>
                Deshacer última
              </button>
              <button onClick={() => setAnnotations([])} style={btn('#f3f4f6', '#374151')}>
                Limpiar ({annotations.length})
              </button>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btn('#f3f4f6', '#374151')}>
              Cancelar
            </button>
            {tool === 'annotate' ? (
              <button
                onClick={applyAnnotations}
                disabled={annotations.length === 0}
                style={{ ...btn('#dc2626', '#fff'), opacity: annotations.length ? 1 : 0.5 }}
              >
                Aplicar y guardar
              </button>
            ) : tool === 'focus' ? (
              <>
                <button onClick={applyZoom} style={btn('#111827', '#fff')}>
                  Acercar al punto
                </button>
                <button onClick={applySpotlight} style={btn('#dc2626', '#fff')}>
                  Aplicar resaltado
                </button>
              </>
            ) : (
              <button
                onClick={() => (tool === 'crop' ? applyCrop() : applyRedactions())}
                disabled={!canApply}
                style={{ ...btn('#dc2626', '#fff'), opacity: canApply ? 1 : 0.5 }}
              >
                {tool === 'crop' ? 'Aplicar recorte' : 'Aplicar y guardar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,24,39,0.6)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
  padding: 20,
};

const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  padding: 18,
  maxWidth: 900,
  width: '100%',
  maxHeight: '92vh',
  overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};

const iconBtn: React.CSSProperties = {
  border: 'none',
  background: '#f3f4f6',
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: 'pointer',
  fontSize: 14,
};

function tab(active: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: active ? '#fff' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : undefined,
  };
}

function btn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '9px 14px',
    background: bg,
    color,
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}
