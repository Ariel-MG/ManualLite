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

const MAX_DISPLAY_W = 820;

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

  // Dimensiones de visualización (la imagen natural se escala por CSS).
  const [display, setDisplay] = useState({ w: 0, h: 0, scale: 1 });
  const [crop, setCrop] = useState<Rect | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const url = URL.createObjectURL(step.annotated ?? step.screenshot);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [step]);

  function onImgLoad() {
    const natW = imgRef.current?.naturalWidth ?? step.width;
    const natH = imgRef.current?.naturalHeight ?? step.height;
    const w = Math.min(MAX_DISPLAY_W, natW);
    const scale = w / natW;
    setDisplay({ w, h: natH * scale, scale });
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
    dragging.current = true;
    setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onMove(e: React.PointerEvent) {
    if (!dragging.current || !crop) return;
    const p = pointer(e);
    setCrop({ ...crop, w: p.x - crop.x, h: p.y - crop.y });
  }

  function onUp() {
    dragging.current = false;
  }

  async function apply() {
    if (!crop) return;
    const c = norm(crop);
    if (c.w < 5 || c.h < 5) return;

    const img = imgRef.current!;
    const s = 1 / display.scale; // display → coords naturales
    const sx = Math.round(c.x * s);
    const sy = Math.round(c.y * s);
    const sw = Math.round(c.w * s);
    const sh = Math.round(c.h * s);

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    );
    onApply({ annotated: blob, width: sw, height: sh });
  }

  const c = crop ? norm(crop) : null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Recortar imagen</strong>
          <span style={{ marginLeft: 10, fontSize: 12, color: '#6b7280' }}>
            Arrastra para seleccionar el área a conservar.
          </span>
          <button onClick={onClose} style={{ marginLeft: 'auto', ...iconBtn }}>
            ✕
          </button>
        </div>

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
            {c && c.w > 0 && c.h > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: c.x,
                  top: c.y,
                  width: c.w,
                  height: c.h,
                  border: '2px solid #dc2626',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          {crop && (
            <button onClick={() => setCrop(null)} style={btn('#f3f4f6', '#374151')}>
              Limpiar selección
            </button>
          )}
          <button onClick={onClose} style={btn('#f3f4f6', '#374151')}>
            Cancelar
          </button>
          <button
            onClick={apply}
            disabled={!c || c.w < 5 || c.h < 5}
            style={{ ...btn('#dc2626', '#fff'), opacity: !c || c.w < 5 || c.h < 5 ? 0.5 : 1 }}
          >
            Aplicar recorte
          </button>
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
