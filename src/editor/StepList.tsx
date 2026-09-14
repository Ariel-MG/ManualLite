import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Step, StepVariant } from '../types';
import { fileToPngImage } from '../lib/image';

interface Props {
  steps: Step[];
  onReorder: (orderedIds: string[]) => void;
  onCaption: (id: string, caption: string) => void;
  onDescription: (id: string, description: string) => void;
  onEditImage: (step: Step) => void;
  onUpdateVariants: (stepId: string, variants: StepVariant[]) => void;
  onEditVariantImage: (step: Step, variant: StepVariant) => void;
  onDelete: (id: string) => void;
}

export function StepList({
  steps,
  onReorder,
  onCaption,
  onDescription,
  onEditImage,
  onUpdateVariants,
  onEditVariantImage,
  onDelete,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Object URLs por paso (se regeneran si cambia el set de imágenes).
  const [urls, setUrls] = useState<Record<string, string>>({});
  const imageKey = useMemo(
    () =>
      steps
        .map((s) => {
          const img = s.annotated ?? s.screenshot;
          return img ? s.id + ':' + img.size : s.id + ':none';
        })
        .join('|'),
    [steps],
  );
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const s of steps) {
      const img = s.annotated ?? s.screenshot;
      if (img) map[s.id] = URL.createObjectURL(img);
    }
    setUrls(map);
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(steps, oldIndex, newIndex);
    onReorder(reordered.map((s) => s.id));
  }

  if (steps.length === 0) {
    return (
      <div
        style={{
          background: '#fff',
          border: '1px dashed #d1d5db',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          color: '#6b7280',
        }}
      >
        Aún no hay pasos. Abre el popup de ManualLite en una página y pulsa
        <strong> Iniciar grabación</strong>; cada click creará un paso.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(() => {
            let actionNo = 0;
            return steps.map((step) => {
              if (step.kind === 'action') actionNo += 1;
              return (
                <SortableStep
                  key={step.id}
                  step={step}
                  actionNumber={step.kind === 'action' ? actionNo : undefined}
                  url={urls[step.id]}
                  onCaption={onCaption}
                  onDescription={onDescription}
                  onEditImage={onEditImage}
                  onUpdateVariants={onUpdateVariants}
                  onEditVariantImage={onEditVariantImage}
                  onDelete={onDelete}
                />
              );
            });
          })()}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableStep({
  step,
  actionNumber,
  url,
  onCaption,
  onDescription,
  onEditImage,
  onUpdateVariants,
  onEditVariantImage,
  onDelete,
}: {
  step: Step;
  actionNumber?: number;
  url?: string;
  onCaption: (id: string, caption: string) => void;
  onDescription: (id: string, description: string) => void;
  onEditImage: (step: Step) => void;
  onUpdateVariants: (stepId: string, variants: StepVariant[]) => void;
  onEditVariantImage: (step: Step, variant: StepVariant) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const isSection = step.kind === 'section';
  const isNote = step.kind === 'note';
  const isRule = step.kind === 'rule';

  const wrapStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isNote ? '#fffbeb' : isRule ? '#eff6ff' : '#fff',
    border: isNote
      ? '1px solid #fde68a'
      : isRule
        ? '1px solid #bfdbfe'
        : '1px solid #e5e7eb',
    borderRadius: 12,
    padding: isSection ? '10px 16px' : 16,
    display: 'flex',
    gap: 16,
    alignItems: isSection ? 'center' : 'flex-start',
  };

  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      title="Arrastrar para reordenar"
      style={{ cursor: 'grab', border: 'none', background: 'transparent', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: 4 }}
    >
      ⠿
    </button>
  );

  const deleteBtn = (
    <button
      onClick={() => onDelete(step.id)}
      title="Borrar"
      style={{ alignSelf: isSection ? 'center' : 'flex-start', border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 15 }}
    >
      ✕
    </button>
  );

  // --- Sección ---
  if (isSection) {
    return (
      <div ref={setNodeRef} style={wrapStyle}>
        {dragHandle}
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em' }}>SECCIÓN</span>
        <input
          value={step.caption}
          onChange={(e) => onCaption(step.id, e.target.value)}
          placeholder="Título de la sección"
          style={{ flex: 1, border: '1px solid transparent', borderRadius: 6, padding: '6px 8px', fontSize: 17, fontWeight: 700, background: '#f9fafb' }}
        />
        {deleteBtn}
      </div>
    );
  }

  // --- Nota ---
  if (isNote) {
    return (
      <div ref={setNodeRef} style={wrapStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💡</span>
          {dragHandle}
        </div>
        <div style={{ flex: 1 }}>
          <textarea
            value={step.description ?? ''}
            onChange={(e) => onDescription(step.id, e.target.value)}
            placeholder="Escribe la nota o aviso…"
            rows={2}
            style={{ width: '100%', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', color: '#92400e', background: '#fffdf5' }}
          />
        </div>
        {deleteBtn}
      </div>
    );
  }

  // --- Regla / comportamiento condicional ---
  if (isRule) {
    return (
      <div ref={setNodeRef} style={wrapStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚖️</span>
          {dragHandle}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.05em', marginBottom: 6 }}>
            REGLA
          </div>
          <textarea
            value={step.description ?? ''}
            onChange={(e) => onDescription(step.id, e.target.value)}
            placeholder="Describe la regla o el comportamiento condicional…"
            rows={2}
            style={{ width: '100%', border: '1px solid #bfdbfe', borderRadius: 6, padding: '8px 10px', fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', color: '#1e3a8a', background: '#f5f9ff' }}
          />
        </div>
        {deleteBtn}
      </div>
    );
  }

  // --- Acción (con imagen) ---
  return (
    <div ref={setNodeRef} style={wrapStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span
          style={{ width: 28, height: 28, borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}
        >
          {actionNumber}
        </span>
        {dragHandle}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={step.caption}
          onChange={(e) => onCaption(step.id, e.target.value)}
          style={{ border: '1px solid transparent', borderRadius: 6, padding: '6px 8px', fontSize: 15, fontWeight: 600, background: '#f9fafb' }}
        />
        {url && (
          <div style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}>
            <img
              src={url}
              alt={step.caption}
              style={{ width: '100%', maxWidth: 640, border: '1px solid #e5e7eb', borderRadius: 8, display: 'block' }}
            />
            <button
              onClick={() => onEditImage(step)}
              title="Editar imagen"
              style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'rgba(17,24,39,0.85)', color: '#fff', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              ✎ Editar imagen
            </button>
          </div>
        )}
        <textarea
          value={step.description ?? ''}
          onChange={(e) => onDescription(step.id, e.target.value)}
          placeholder="Añade una descripción para este paso (opcional)…"
          rows={2}
          style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', color: '#374151' }}
        />
        {step.url && <span style={{ fontSize: 11, color: '#9ca3af' }}>{step.url}</span>}

        <VariantList
          step={step}
          onUpdate={(variants) => onUpdateVariants(step.id, variants)}
          onEditImage={(variant) => onEditVariantImage(step, variant)}
        />
      </div>

      {deleteBtn}
    </div>
  );
}

/** Editor de variantes (caminos alternativos) de un paso de acción. */
function VariantList({
  step,
  onUpdate,
  onEditImage,
}: {
  step: Step;
  onUpdate: (variants: StepVariant[]) => void;
  onEditImage: (variant: StepVariant) => void;
}) {
  const variants = step.variants ?? [];

  // Object URLs por variante (se regeneran si cambian las imágenes).
  const [urls, setUrls] = useState<Record<string, string>>({});
  const imageKey = useMemo(
    () =>
      variants
        .map((v) => {
          const img = v.annotated ?? v.screenshot;
          return img ? v.id + ':' + img.size : v.id + ':none';
        })
        .join('|'),
    [variants],
  );
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const v of variants) {
      const img = v.annotated ?? v.screenshot;
      if (img) map[v.id] = URL.createObjectURL(img);
    }
    setUrls(map);
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  function patch(id: string, p: Partial<StepVariant>) {
    onUpdate(variants.map((v) => (v.id === id ? { ...v, ...p } : v)));
  }
  function add() {
    onUpdate([...variants, { id: crypto.randomUUID(), label: '' }]);
  }
  function remove(id: string) {
    onUpdate(variants.filter((v) => v.id !== id));
  }
  async function upload(id: string, file: File) {
    const { blob, width, height } = await fileToPngImage(file);
    // Una imagen nueva reemplaza cualquier anotación previa.
    patch(id, { screenshot: blob, annotated: undefined, width, height });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      {variants.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em' }}>
          CAMINOS / VARIANTES
        </div>
      )}
      {variants.map((v) => (
        <div
          key={v.id}
          style={{ border: '1px solid #e5e7eb', borderLeft: '3px solid #6366f1', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#fafafe' }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, color: '#6366f1' }}>↳</span>
            <input
              value={v.label}
              onChange={(e) => patch(v.id, { label: e.target.value })}
              placeholder='Condición, p. ej. "Si IMSS / Bienestar"'
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 14, fontWeight: 600, background: '#fff' }}
            />
            <button
              onClick={() => remove(v.id)}
              title="Quitar variante"
              style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 13 }}
            >
              ✕
            </button>
          </div>

          {urls[v.id] ? (
            <div style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}>
              <img
                src={urls[v.id]}
                alt={v.label}
                style={{ width: '100%', maxWidth: 480, border: '1px solid #e5e7eb', borderRadius: 8, display: 'block' }}
              />
              <button
                onClick={() => onEditImage(v)}
                title="Editar imagen"
                style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'rgba(17,24,39,0.85)', color: '#fff', borderRadius: 7, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                ✎ Editar imagen
              </button>
            </div>
          ) : (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', border: '1px dashed #c7d2fe', color: '#4f46e5', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff' }}>
              + Imagen
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) upload(v.id, f);
                }}
                style={{ display: 'none' }}
              />
            </label>
          )}

          <textarea
            value={v.description ?? ''}
            onChange={(e) => patch(v.id, { description: e.target.value })}
            placeholder="Qué ocurre en este caso (opcional)…"
            rows={2}
            style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', color: '#374151', background: '#fff' }}
          />
        </div>
      ))}

      <button
        onClick={add}
        style={{ alignSelf: 'flex-start', border: '1px dashed #c7d2fe', background: '#fff', color: '#4f46e5', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        + Variante (camino alternativo)
      </button>
    </div>
  );
}
