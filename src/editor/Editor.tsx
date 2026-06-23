import { useCallback, useEffect, useState } from 'react';
import type { Manual, Step } from '../types';
import {
  deleteStep,
  getManual,
  getSteps,
  listManuals,
  reorderSteps,
  updateManual,
  updateStep,
} from '../db';
import { CoverForm } from './CoverForm';
import { StepList } from './StepList';
import { ExportBar } from './ExportBar';

function getManualIdFromUrl(): string | null {
  return new URLSearchParams(location.search).get('id');
}

export function Editor() {
  const [manual, setManual] = useState<Manual | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let id = getManualIdFromUrl();
    if (!id) {
      // Sin id: abrir el manual más reciente, si existe.
      const all = await listManuals();
      id = all[0]?.id ?? null;
    }
    if (!id) {
      setLoading(false);
      return;
    }
    const m = await getManual(id);
    if (m) {
      setManual(m);
      setSteps(await getSteps(id));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patchManual(patch: Partial<Pick<Manual, 'title' | 'subtitle' | 'logo'>>) {
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

  if (loading) {
    return <Centered>Cargando…</Centered>;
  }

  if (!manual) {
    return (
      <Centered>
        No hay ningún manual todavía. Abre el popup de ManualLite y graba uno.
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
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#dc2626',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
          }}
        >
          S
        </div>
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
          onDelete={removeStep}
        />
      </div>
    </div>
  );
}

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
