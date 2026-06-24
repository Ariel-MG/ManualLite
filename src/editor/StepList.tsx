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
import type { Step } from '../types';

interface Props {
  steps: Step[];
  onReorder: (orderedIds: string[]) => void;
  onCaption: (id: string, caption: string) => void;
  onDescription: (id: string, description: string) => void;
  onEditImage: (step: Step) => void;
  onDelete: (id: string) => void;
}

export function StepList({ steps, onReorder, onCaption, onDescription, onEditImage, onDelete }: Props) {
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
  onDelete,
}: {
  step: Step;
  actionNumber?: number;
  url?: string;
  onCaption: (id: string, caption: string) => void;
  onDescription: (id: string, description: string) => void;
  onEditImage: (step: Step) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const isSection = step.kind === 'section';
  const isNote = step.kind === 'note';

  const wrapStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isNote ? '#fffbeb' : '#fff',
    border: isNote ? '1px solid #fde68a' : '1px solid #e5e7eb',
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
      </div>

      {deleteBtn}
    </div>
  );
}
