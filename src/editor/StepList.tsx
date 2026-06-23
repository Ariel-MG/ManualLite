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
  onDelete: (id: string) => void;
}

export function StepList({ steps, onReorder, onCaption, onDescription, onDelete }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Object URLs por paso (se regeneran si cambia el set de imágenes).
  const [urls, setUrls] = useState<Record<string, string>>({});
  const imageKey = useMemo(
    () => steps.map((s) => s.id + ':' + (s.annotated ?? s.screenshot).size).join('|'),
    [steps],
  );
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const s of steps) map[s.id] = URL.createObjectURL(s.annotated ?? s.screenshot);
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
          {steps.map((step, i) => (
            <SortableStep
              key={step.id}
              step={step}
              index={i}
              url={urls[step.id]}
              onCaption={onCaption}
              onDescription={onDescription}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableStep({
  step,
  index,
  url,
  onCaption,
  onDescription,
  onDelete,
}: {
  step: Step;
  index: number;
  url?: string;
  onCaption: (id: string, caption: string) => void;
  onDescription: (id: string, description: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#dc2626',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {index + 1}
        </span>
        <button
          {...attributes}
          {...listeners}
          title="Arrastrar para reordenar"
          style={{
            cursor: 'grab',
            border: 'none',
            background: 'transparent',
            color: '#9ca3af',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ⠿
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={step.caption}
          onChange={(e) => onCaption(step.id, e.target.value)}
          style={{
            border: '1px solid transparent',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 15,
            fontWeight: 600,
            background: '#f9fafb',
          }}
        />
        {url && (
          <img
            src={url}
            alt={step.caption}
            style={{
              width: '100%',
              maxWidth: 640,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          />
        )}
        <textarea
          value={step.description ?? ''}
          onChange={(e) => onDescription(step.id, e.target.value)}
          placeholder="Añade una descripción para este paso (opcional)…"
          rows={2}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: 'inherit',
            resize: 'vertical',
            color: '#374151',
          }}
        />
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{step.url}</span>
      </div>

      <button
        onClick={() => onDelete(step.id)}
        title="Borrar paso"
        style={{
          alignSelf: 'flex-start',
          border: 'none',
          background: '#fef2f2',
          color: '#dc2626',
          borderRadius: 6,
          width: 30,
          height: 30,
          cursor: 'pointer',
          fontSize: 15,
        }}
      >
        ✕
      </button>
    </div>
  );
}
