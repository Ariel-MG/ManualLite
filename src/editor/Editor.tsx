import { useCallback, useEffect, useState } from 'react';
import type { Manual, Step } from '../types';
import {
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

function getManualIdFromUrl(): string | null {
  return new URLSearchParams(location.search).get('id');
}

export function Editor() {
  const [manualId, setManualId] = useState<string | null>(getManualIdFromUrl());
  const [manual, setManual] = useState<Manual | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [editImage, setEditImage] = useState<Step | null>(null);

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

  async function patchManual(patch: Partial<Pick<Manual, 'title' | 'subtitle' | 'logo' | 'accentColor'>>) {
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

  async function applyImagePatch(patch: ImagePatch) {
    if (!editImage) return;
    const id = editImage.id;
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await updateStep(id, patch);
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
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px 80px' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <CoverForm manual={manual} onChange={patchManual} />
        <StepList
          steps={steps}
          onReorder={reorder}
          onCaption={changeCaption}
          onDescription={changeDescription}
          onEditImage={setEditImage}
          onDelete={removeStep}
        />
      </div>

      {editImage && (
        <StepImageEditor
          step={editImage}
          onClose={() => setEditImage(null)}
          onApply={applyImagePatch}
        />
      )}
    </div>
  );
}

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
