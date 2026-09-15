import { afterEach, describe, expect, it, vi } from 'vitest';
import { annotateScreenshot } from './annotate';

type CtxCall =
  | { op: 'drawImage'; bitmap: unknown; x: number; y: number }
  | { op: 'beginPath' }
  | { op: 'arc'; x: number; y: number; r: number; start: number; end: number }
  | { op: 'fillStyle'; value: string }
  | { op: 'fill' }
  | { op: 'lineWidth'; value: number }
  | { op: 'strokeStyle'; value: string }
  | { op: 'stroke' };

function createMockCtx() {
  const calls: CtxCall[] = [];
  const ctx = {
    drawImage(bitmap: unknown, x: number, y: number) {
      calls.push({ op: 'drawImage', bitmap, x, y });
    },
    beginPath() {
      calls.push({ op: 'beginPath' });
    },
    arc(x: number, y: number, r: number, start: number, end: number) {
      calls.push({ op: 'arc', x, y, r, start, end });
    },
    fill() {
      calls.push({ op: 'fill' });
    },
    stroke() {
      calls.push({ op: 'stroke' });
    },
    set fillStyle(value: string) {
      calls.push({ op: 'fillStyle', value });
    },
    set strokeStyle(value: string) {
      calls.push({ op: 'strokeStyle', value });
    },
    set lineWidth(value: number) {
      calls.push({ op: 'lineWidth', value });
    },
  };
  return { ctx, calls };
}

describe('annotateScreenshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tras drawImage pinta el anillo en el click y tamaño del bitmap', async () => {
    const width = 800;
    const height = 600;
    const click = { x: 100, y: 80 };
    const radius = Math.max(16, Math.min(width, height) * 0.025);
    const bitmap = { width, height, close: vi.fn() };
    const annotated = new Blob(['ann']);
    const { ctx, calls } = createMockCtx();

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return ctx;
        }
        convertToBlob() {
          return Promise.resolve(annotated);
        }
      },
    );

    const result = await annotateScreenshot(new Blob(['src']), click);

    expect(calls[0]).toEqual({ op: 'drawImage', bitmap, x: 0, y: 0 });
    expect(calls.slice(1)).toEqual([
      { op: 'beginPath' },
      { op: 'arc', x: 100, y: 80, r: radius * 1.9, start: 0, end: Math.PI * 2 },
      { op: 'fillStyle', value: 'rgba(220, 38, 38, 0.18)' },
      { op: 'fill' },
      { op: 'beginPath' },
      { op: 'arc', x: 100, y: 80, r: radius, start: 0, end: Math.PI * 2 },
      { op: 'lineWidth', value: Math.max(5, radius * 0.28) },
      { op: 'strokeStyle', value: 'rgba(255, 255, 255, 0.9)' },
      { op: 'stroke' },
      { op: 'beginPath' },
      { op: 'arc', x: 100, y: 80, r: radius, start: 0, end: Math.PI * 2 },
      { op: 'lineWidth', value: Math.max(3, radius * 0.18) },
      { op: 'strokeStyle', value: '#dc2626' },
      { op: 'stroke' },
    ]);
    expect(result).toEqual({ blob: annotated, width, height });
  });
});
