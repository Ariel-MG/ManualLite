import { useEffect, useMemo, useState } from 'react';
import type { Step } from '../types';
import { anchorId } from './StepList';

/** Un manual con secciones se agrupa; los pasos sueltos van en un grupo sin título. */
interface Group {
  /** Id del paso de sección, o null para los pasos anteriores a la primera. */
  sectionId: string | null;
  title: string;
  steps: { step: Step; actionNumber?: number }[];
}

function groupBySection(steps: Step[]): Group[] {
  const groups: Group[] = [];
  let current: Group = { sectionId: null, title: 'Inicio', steps: [] };
  let actionNo = 0;

  for (const step of steps) {
    if (step.kind === 'section') {
      if (current.steps.length > 0 || current.sectionId !== null) groups.push(current);
      current = { sectionId: step.id, title: step.caption || 'Sección sin título', steps: [] };
      continue;
    }
    if (step.kind === 'action') actionNo += 1;
    current.steps.push({ step, actionNumber: step.kind === 'action' ? actionNo : undefined });
  }
  groups.push(current);
  return groups.filter((g) => g.steps.length > 0 || g.sectionId !== null);
}

function scrollTo(stepId: string) {
  document.getElementById(anchorId(stepId))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Etiqueta corta de un paso en el índice. */
function label(step: Step, actionNumber?: number): string {
  if (step.kind === 'action') return `${actionNumber}. ${step.caption || 'Sin título'}`;
  const text = (step.description ?? '').trim();
  const icon = step.kind === 'note' ? '💡' : '⚖️';
  return `${icon} ${text || (step.kind === 'note' ? 'Nota vacía' : 'Regla vacía')}`;
}

/**
 * Índice lateral del manual. En manuales largos el scroll no basta para
 * orientarse: esto permite saltar a cualquier punto y, sobre todo, saber en
 * qué parte del manual estás en cada momento.
 */
export function StepOutline({ steps }: { steps: Step[] }) {
  const groups = useMemo(() => groupBySection(steps), [steps]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  // Ids en orden. Como clave del efecto usamos la cadena y no el array: así
  // teclear en un caption no reconstruye el observer de los 130 pasos.
  const orderKey = steps.map((s) => s.id).join('|');
  const orderedIds = useMemo(() => orderKey.split('|'), [orderKey]);

  // Resalta el paso visible más arriba en pantalla.
  useEffect(() => {
    if (orderedIds.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.replace(/^step-/, '');
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        // El orden del manual manda: nos quedamos con el primero visible.
        const first = orderedIds.find((id) => visible.has(id));
        if (first) setActiveId(first);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    for (const id of orderedIds) {
      const node = document.getElementById(anchorId(id));
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [orderedIds]);

  if (steps.length === 0) return null;

  return (
    <nav
      aria-label="Índice del manual"
      style={{
        position: 'sticky',
        top: 24,
        alignSelf: 'flex-start',
        width: 240,
        flexShrink: 0,
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 12,
        fontSize: 13,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#9ca3af',
          letterSpacing: '0.05em',
          marginBottom: 10,
        }}
      >
        ÍNDICE
      </div>

      {groups.map((group) => {
        const key = group.sectionId ?? '__inicio__';
        const isCollapsed = collapsed[key];
        return (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))}
                title={isCollapsed ? 'Desplegar' : 'Plegar'}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: 10,
                  lineHeight: 1,
                }}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
              <button
                onClick={() => group.sectionId && scrollTo(group.sectionId)}
                disabled={!group.sectionId}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  border: 'none',
                  background:
                    group.sectionId && activeId === group.sectionId ? '#fef2f2' : 'transparent',
                  color: group.sectionId ? '#111827' : '#9ca3af',
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: group.sectionId ? 'pointer' : 'default',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.title}
              </button>
            </div>

            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 12 }}>
                {group.steps.map(({ step, actionNumber }) => (
                  <button
                    key={step.id}
                    onClick={() => scrollTo(step.id)}
                    style={{
                      textAlign: 'left',
                      border: 'none',
                      borderLeft: `2px solid ${activeId === step.id ? '#dc2626' : '#f3f4f6'}`,
                      background: activeId === step.id ? '#fef2f2' : 'transparent',
                      color: activeId === step.id ? '#dc2626' : '#6b7280',
                      fontWeight: activeId === step.id ? 600 : 400,
                      fontSize: 12,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label(step, actionNumber)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
