import { useCallback, useEffect, useRef, useState } from 'react';
import type { Manual, Step, StepVariant } from '../types';
import {
  addImageStep,
  addTextStep,
  deleteStep,
  getManual,
  getSteps,
  reorderSteps,
  updateManual,
  updateStep,
} from '../db';
import { CoverForm } from './CoverForm';
import { StepList } from './StepList';
import { ExportBar } from './ExportBar';
import { ManualLibrary } from './ManualLibrary';
import { StepImageEditor, type ImagePatch } from './StepImageEditor';
import { StepOutline } from './StepOutline';

function getManualIdFromUrl(): string | null {
  return new URLSearchParams(location.search).get('id');
}

/** Ancho mínimo de ventana para que quepa el índice lateral junto al contenido. */
const WIDE_QUERY = '(min-width: 1100px)';

/** Objetivo de edición de imagen: la imagen principal de un paso o la de una variante. */
type ImageTarget =
  | { kind: 'step'; step: Step }
  | { kind: 'variant'; step: Step; variant: StepVariant };

export function Editor() {
  const [manualId, setManualId] = useState<string | null>(getManualIdFromUrl());
  const [manual, setManual] = useState<Manual | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [editImage, setEditImage] = useState<ImageTarget | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  /** Posición donde insertar la imagen que se está eligiendo (null = al final). */
  const pendingInsertIndex = useRef<number | null>(null);

  function openManual(id: string) {
    history.pushState({}, '', `?id=${id}`);
    setManualId(id);
  }

  function goToLibrary() {
    history.pushState({}, '', location.pathname);
    setManualId(null);
  }

  // Sincroniza con los botones atrás/adelante del navegador.
  useEffect(() => {
    const onPop = () => setManualId(getManualIdFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // El índice lateral solo cabe en ventanas anchas; por debajo estorbaría.
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const load = useCallback(async () => {
    if (!manualId) {
      setManual(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const m = await getManual(manualId);
    if (m) {
      setManual(m);
      setSteps(await getSteps(manualId));
    } else {
      setManual(null);
    }
    setLoading(false);
  }, [manualId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchManual(
    patch: Partial<
      Pick<
        Manual,
        | 'title'
        | 'subtitle'
        | 'logo'
        | 'accentColor'
        | 'author'
        | 'version'
        | 'company'
        | 'confidentiality'
        | 'pageSize'
      >
    >,
  ) {
    if (!manual) return;
    setManual({ ...manual, ...patch });
    await updateManual(manual.id, patch);
  }

  async function changeCaption(id: string, caption: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, caption } : s)));
    await updateStep(id, { caption });
  }

  async function changeDescription(id: string, description: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, description } : s)));
    await updateStep(id, { description });
  }

  async function removeStep(id: string) {
    await deleteStep(id);
    if (manual) setSteps(await getSteps(manual.id));
  }

  async function reorder(orderedIds: string[]) {
    if (!manual) return;
    const byId = new Map(steps.map((s) => [s.id, s]));
    setSteps(orderedIds.map((id, i) => ({ ...byId.get(id)!, order: i })));
    await reorderSteps(manual.id, orderedIds);
  }

  async function refreshSteps() {
    if (manual) setSteps(await getSteps(manual.id));
  }

  /** Sin `index` el paso va al final; con `index` se inserta en esa posición. */
  async function addText(kind: 'section' | 'note' | 'rule', index?: number) {
    if (!manual) return;
    await addTextStep(manual.id, kind, index);
    setSteps(await getSteps(manual.id));
  }

  /** Añade contenido en un punto de inserción de la lista. */
  function insertAt(kind: 'section' | 'note' | 'rule' | 'image', index: number) {
    if (kind === 'image') {
      pendingInsertIndex.current = index;
      imageInputRef.current?.click();
      return;
    }
    addText(kind, index);
  }

  async function updateVariants(stepId: string, variants: StepVariant[]) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, variants } : s)));
    await updateStep(stepId, { variants });
  }

  async function addImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    // El input es único y oculto: la posición destino la dejó `insertAt`.
    const index = pendingInsertIndex.current ?? undefined;
    pendingInsertIndex.current = null;
    if (!file || !manual) return;
    try {
      await addImageStep(manual.id, file, index);
      setSteps(await getSteps(manual.id));
    } catch {
      alert('No se pudo cargar la imagen. Asegúrate de que sea un archivo de imagen válido.');
    }
  }

  async function applyImagePatch(patch: ImagePatch) {
    if (!editImage) return;
    if (editImage.kind === 'step') {
      const id = editImage.step.id;
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      await updateStep(id, patch);
    } else {
      const { step, variant } = editImage;
      const variants = (step.variants ?? []).map((v) =>
        v.id === variant.id ? { ...v, ...patch } : v,
      );
      await updateVariants(step.id, variants);
    }
    setEditImage(null);
  }

  if (!manualId) {
    return <ManualLibrary onOpen={openManual} />;
  }

  if (loading) {
    return <Centered>Cargando…</Centered>;
  }

  if (!manual) {
    return (
      <Centered>
        Este manual no existe.{' '}
        <button onClick={goToLibrary} style={{ ...linkBtn }}>
          Volver a Manuales
        </button>
      </Centered>
    );
  }

  return (
    <div
      style={{
        maxWidth: wide ? 1160 : 880,
        margin: '0 auto',
        padding: '24px 20px 80px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={goToLibrary}
          title="Volver a Manuales"
          style={{
            border: '1px solid #d1d5db',
            background: '#fff',
            borderRadius: 8,
            padding: '7px 11px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          ← Manuales
        </button>
        <strong style={{ fontSize: 18 }}>ManualLite</strong>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>
          {steps.length} {steps.length === 1 ? 'paso' : 'pasos'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={refreshSteps}
            style={{
              padding: '9px 12px',
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↻ Actualizar
          </button>
          <ExportBar manual={manual} steps={steps} />
        </div>
      </header>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {wide && <StepOutline steps={steps} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <CoverForm manual={manual} onChange={patchManual} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => addText('section')} style={addBtn}>
              + Sección
            </button>
            <button onClick={() => addText('note')} style={addBtn}>
              + Nota
            </button>
            <button onClick={() => addText('rule')} style={addBtn}>
              + Regla
            </button>
            <button
              onClick={() => {
                pendingInsertIndex.current = null;
                imageInputRef.current?.click();
              }}
              style={addBtn}
            >
              + Imagen
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={addImage}
              style={{ display: 'none' }}
            />
          </div>
          <StepList
            steps={steps}
            onReorder={reorder}
            onCaption={changeCaption}
            onDescription={changeDescription}
            onEditImage={(step) => setEditImage({ kind: 'step', step })}
            onUpdateVariants={updateVariants}
            onEditVariantImage={(step, variant) => setEditImage({ kind: 'variant', step, variant })}
            onDelete={removeStep}
            onInsert={insertAt}
          />
        </div>
      </div>

      {editImage && (
        <StepImageEditor
          source={editImage.kind === 'step' ? editImage.step : editImage.variant}
          onClose={() => setEditImage(null)}
          onApply={applyImagePatch}
        />
      )}
    </div>
  );
}

const addBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: '#fff',
  border: '1px dashed #d1d5db',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
};

const linkBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#dc2626',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 40,
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 15,
        maxWidth: 520,
        margin: '0 auto',
      }}
    >
      {children}
    </div>
  );
}
