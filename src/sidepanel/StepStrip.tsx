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
  onDelete: (id: string) => void;
}

export function StepStrip({ steps, onReorder, onCaption, onDelete }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const imageKey = useMemo(
    () =>
      steps
        .map((s) => {
          const img = s.annotated ?? s.screenshot;
          return img ? `${s.id}:${img.size}` : `${s.id}:none`;
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
    // imageKey cubre altas/bajas/reorden; un cambio de caption no debe recrear URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(steps, oldIndex, newIndex).map((s) => s.id));
  }

  if (steps.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
        Haz click en la página para capturar. Las miniaturas aparecerán aquí.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((step, i) => (
            <SortableCapture
              key={step.id}
              step={step}
              index={i + 1}
              url={urls[step.id]}
              onCaption={onCaption}
              onDelete={onDelete}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableCapture({
  step,
  index,
  url,
  onCaption,
  onDelete,
}: {
  step: Step;
  index: number;
  url?: string;
  onCaption: (id: string, caption: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          aria-label={`Reordenar paso ${index}`}
          {...attributes}
          {...listeners}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#9ca3af',
            cursor: 'grab',
            padding: '0 2px',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ⋮⋮
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>{index}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          aria-label={`Borrar paso ${index}`}
          onClick={() => onDelete(step.id)}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      </div>
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            aspectRatio: '16 / 10',
            objectFit: 'cover',
            borderRadius: 6,
            background: '#f3f4f6',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 10',
            borderRadius: 6,
            background: '#f3f4f6',
            color: '#9ca3af',
            fontSize: 11,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          Sin imagen
        </div>
      )}
      <CaptionLine value={step.caption} onSave={(caption) => onCaption(step.id, caption)} />
    </li>
  );
}

function CaptionLine({ value, onSave }: { value: string; onSave: (caption: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next !== value) onSave(next);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Editar título"
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          textAlign: 'left',
          fontSize: 12,
          fontWeight: 600,
          color: value ? '#111827' : '#9ca3af',
          cursor: 'text',
          lineHeight: 1.35,
        }}
      >
        {value || 'Añadir título'}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      aria-label="Título del paso"
      style={{
        width: '100%',
        border: '1px solid #d1d5db',
        borderRadius: 6,
        padding: '4px 6px',
        fontSize: 12,
        fontWeight: 600,
      }}
    />
  );
}
