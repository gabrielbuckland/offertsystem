import { afterEach, describe, expect, it, vi } from 'vitest';
import { rufeApi } from '../../src/components/rufe-api.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('rufeApi', () => {
  it('liefert Status und geparsten Rumpf', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'x' }), { status: 201 })));
    const e = await rufeApi<{ id?: string }>('/api/projekt', { method: 'POST' });
    expect(e).toEqual({ ok: true, status: 201, rumpf: { id: 'x' } });
  });
  it('wird bei Netzausfall nicht zur Ausnahme', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const e = await rufeApi('/api/projekt');
    expect(e.ok).toBe(false);
    expect(e.status).toBe(0);
  });
  it('liefert bei HTML-Fehlerseite einen leeren Rumpf statt zu werfen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('<html>500</html>', { status: 500 })));
    const e = await rufeApi<{ fehler?: { text: string } }>('/api/x');
    expect(e).toEqual({ ok: false, status: 500, rumpf: {} });
  });
});
