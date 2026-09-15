import { describe, expect, it } from 'vitest';
import { paintClickRing } from './clickRing';

type CtxCall =
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
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function paint(x: number, y: number, width: number, height: number) {
  const mock = createMockCtx();
  paintClickRing(mock.ctx, x, y, width, height);
  return mock.calls;
}

function expectedRadius(width: number, height: number): number {
  return Math.max(16, Math.min(width, height) * 0.025);
}

describe('paintClickRing', () => {
  it('pinta halo, trazo blanco y anillo #dc2626 en ese orden (800×600, click 100,80)', () => {
    const calls = paint(100, 80, 800, 600);
    const radius = expectedRadius(800, 600);

    expect(calls).toEqual([
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
  });

  it('usa radio mínimo 16 y halo 30.4 cuando min(width, height) * 0.025 < 16', () => {
    const calls = paint(40, 40, 400, 300);
    const halo = calls.find((c) => c.op === 'arc');
    const ringArcs = calls.filter((c) => c.op === 'arc').slice(1);

    expect(expectedRadius(400, 300)).toBe(16);
    expect(halo).toMatchObject({ op: 'arc', r: 30.4 });
    expect(ringArcs).toEqual([
      { op: 'arc', x: 40, y: 40, r: 16, start: 0, end: Math.PI * 2 },
      { op: 'arc', x: 40, y: 40, r: 16, start: 0, end: Math.PI * 2 },
    ]);
  });

  it('usa radio relativo 30 en canvas 2000×1200', () => {
    const calls = paint(200, 150, 2000, 1200);
    const arcs = calls.filter((c) => c.op === 'arc');
    const widths = calls.filter((c) => c.op === 'lineWidth');

    expect(expectedRadius(2000, 1200)).toBe(30);
    expect(arcs[0]).toMatchObject({ r: 57 });
    expect(arcs[1]).toMatchObject({ r: 30 });
    expect(arcs[2]).toMatchObject({ r: 30 });
    expect(widths).toEqual([
      { op: 'lineWidth', value: Math.max(5, 30 * 0.28) },
      { op: 'lineWidth', value: Math.max(3, 30 * 0.18) },
    ]);
  });
});
