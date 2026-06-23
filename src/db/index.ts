import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Manual, Step } from '../types';

interface ManualLiteDB extends DBSchema {
  manuals: {
    key: string;
    value: Manual;
  };
  steps: {
    key: string;
    value: Step;
    indexes: { 'by-manual': string };
  };
}

const DB_NAME = 'manuallite';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ManualLiteDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ManualLiteDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ManualLiteDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('manuals')) {
          db.createObjectStore('manuals', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('steps')) {
          const steps = db.createObjectStore('steps', { keyPath: 'id' });
          steps.createIndex('by-manual', 'manualId');
        }
      },
    });
  }
  return dbPromise;
}

function uid(): string {
  return crypto.randomUUID();
}

// --- Manuals ---

export async function createManual(title = 'Manual sin título'): Promise<Manual> {
  const now = Date.now();
  const manual: Manual = { id: uid(), title, createdAt: now, updatedAt: now };
  const db = await getDB();
  await db.put('manuals', manual);
  return manual;
}

export async function getManual(id: string): Promise<Manual | undefined> {
  const db = await getDB();
  return db.get('manuals', id);
}

export async function listManuals(): Promise<Manual[]> {
  const db = await getDB();
  const all = await db.getAll('manuals');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updateManual(
  id: string,
  patch: Partial<Omit<Manual, 'id' | 'createdAt'>>,
): Promise<Manual | undefined> {
  const db = await getDB();
  const existing = await db.get('manuals', id);
  if (!existing) return undefined;
  const updated: Manual = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put('manuals', updated);
  return updated;
}

export async function deleteManual(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['manuals', 'steps'], 'readwrite');
  await tx.objectStore('manuals').delete(id);
  const stepIds = await tx.objectStore('steps').index('by-manual').getAllKeys(id);
  await Promise.all(stepIds.map((sid) => tx.objectStore('steps').delete(sid)));
  await tx.done;
}

// --- Steps ---

export async function addStep(
  step: Omit<Step, 'id' | 'order' | 'createdAt'>,
): Promise<Step> {
  const db = await getDB();
  const count = await db.getAllFromIndex('steps', 'by-manual', step.manualId);
  const full: Step = {
    ...step,
    id: uid(),
    order: count.length,
    createdAt: Date.now(),
  };
  await db.put('steps', full);
  await touchManual(step.manualId);
  return full;
}

export async function getSteps(manualId: string): Promise<Step[]> {
  const db = await getDB();
  const steps = await db.getAllFromIndex('steps', 'by-manual', manualId);
  return steps.sort((a, b) => a.order - b.order);
}

export async function countSteps(manualId: string): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('steps', 'by-manual', manualId);
}

export async function updateStep(
  id: string,
  patch: Partial<Omit<Step, 'id' | 'manualId'>>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('steps', id);
  if (!existing) return;
  const updated = { ...existing, ...patch };
  await db.put('steps', updated);
  await touchManual(existing.manualId);
}

export async function deleteStep(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('steps', id);
  if (!existing) return;
  await db.delete('steps', id);
  // Recompactar el orden de los pasos restantes
  const rest = await getSteps(existing.manualId);
  const tx = db.transaction('steps', 'readwrite');
  await Promise.all(
    rest.map((s, i) => tx.store.put({ ...s, order: i })),
  );
  await tx.done;
  await touchManual(existing.manualId);
}

/** Persiste un nuevo orden completo de pasos (tras drag&drop) */
export async function reorderSteps(manualId: string, orderedIds: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('steps', 'readwrite');
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const s = await tx.store.get(id);
      if (s && s.manualId === manualId) {
        await tx.store.put({ ...s, order: index });
      }
    }),
  );
  await tx.done;
  await touchManual(manualId);
}

async function touchManual(manualId: string): Promise<void> {
  const db = await getDB();
  const m = await db.get('manuals', manualId);
  if (m) await db.put('manuals', { ...m, updatedAt: Date.now() });
}
