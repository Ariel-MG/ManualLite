import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('content script sin UI de captura', () => {
  beforeEach(() => {
    window.__manualLiteInjected = false;
    document.body.innerHTML = '<main id="page"><button type="button">Ir</button></main>';
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({
          recording: true,
          paused: false,
          stepCount: 0,
        }),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.body.innerHTML = '';
    window.__manualLiteInjected = false;
  });

  it('tras init el documento no tiene nodos de UI de captura', async () => {
    const before = document.body.innerHTML;
    await import('./index');

    expect(document.getElementById('__manuallite_badge__')).toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(document.body.innerHTML).toBe(before);
    for (const el of Array.from(document.querySelectorAll('*'))) {
      expect(el.shadowRoot).toBeNull();
    }
  });
});
