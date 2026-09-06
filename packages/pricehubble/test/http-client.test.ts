import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/client/http-client.js';
import { erzeugeZufallsquelle } from '../src/client/zufall.js';
import { systemUhr } from '../src/client/uhr.js';
import { sammelndesProtokoll } from '../src/client/protokoll.js';
import { mswServer } from './msw/server.js';
import { BASIS } from './msw/handlers.js';
import { testKonfiguration } from './test-konfiguration.js';

function clientMit(konfiguration = testKonfiguration()): HttpClient {
  return new HttpClient({
    konfiguration,
    uhr: systemUhr,
    zufall: erzeugeZufallsquelle(4242),
    protokoll: sammelndesProtokoll(),
    fetchImpl: globalThis.fetch,
  });
}

const anfrage = (konfiguration = testKonfiguration()) => ({
  endpunkt: 'dossierGet' as const,
  methode: 'GET' as const,
  url: `${BASIS}/probe`,
  timeoutMs: konfiguration.timeoutMs,
});

// Geschweifte Klammern statt Ausdruckskoerper: Ausdruckskoerper reicht den
// `VitestUtils`-Rueckgabewert von `vi.useFakeTimers()` durch, Hooks erwarten `void`.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('HTTP-Client (Spec 04 §6.3, §6.4)', () => {
  it('liefert bei 200 den Rumpf samt x-ph-request-id', async () => {
    mswServer.use(
      http.get(`${BASIS}/probe`, () =>
        HttpResponse.json({ a: 1 }, { headers: { 'x-ph-request-id': 'r-1' } }),
      ),
    );
    const ergebnis = await clientMit().fuehreAus(anfrage());
    expect(ergebnis).toMatchObject({
      ok: true,
      wert: { httpStatus: 200, rumpf: { a: 1 }, phRequestId: 'r-1' },
    });
  });

  it('wiederholt 5xx bis maxVersuche und meldet dann ServerError (AK-7)', async () => {
    let anzahl = 0;
    mswServer.use(
      http.get(`${BASIS}/probe`, () => {
        anzahl += 1;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    const lauf = clientMit().fuehreAus(anfrage());
    await vi.advanceTimersByTimeAsync(20_000);
    const ergebnis = await lauf;
    expect(anzahl).toBe(3);
    expect(ergebnis).toMatchObject({ ok: false, fehler: { art: 'ServerError', versuche: 3 } });
  });

  it('wiederholt 4xx NICHT (AK-8)', async () => {
    let anzahl = 0;
    mswServer.use(
      http.get(`${BASIS}/probe`, () => {
        anzahl += 1;
        return HttpResponse.json({ field: 'property.livingArea' }, { status: 400 });
      }),
    );
    const ergebnis = await clientMit().fuehreAus(anfrage());
    expect(anzahl).toBe(1);
    expect(ergebnis).toMatchObject({ ok: false, fehler: { art: 'ClientError', versuche: 1 } });
  });

  it('meldet 404 als NotFoundError ohne Wiederholung', async () => {
    mswServer.use(http.get(`${BASIS}/probe`, () => new HttpResponse(null, { status: 404 })));
    const ergebnis = await clientMit().fuehreAus(anfrage());
    expect(ergebnis).toMatchObject({ ok: false, fehler: { art: 'NotFoundError' } });
  });

  it('meldet 401 als AuthError ohne Wiederholung', async () => {
    mswServer.use(http.get(`${BASIS}/probe`, () => new HttpResponse(null, { status: 401 })));
    const ergebnis = await clientMit().fuehreAus(anfrage());
    expect(ergebnis).toMatchObject({ ok: false, fehler: { art: 'AuthError', versuche: 1 } });
  });

  it('meldet ein ueberschrittenes Zeitlimit als TimeoutError', async () => {
    const kurz = testKonfiguration({ timeoutMs: 1000 });
    mswServer.use(
      http.get(`${BASIS}/probe`, async () => {
        await new Promise((r) => setTimeout(r, 60_000));
        return HttpResponse.json({});
      }),
    );
    const lauf = clientMit(kurz).fuehreAus(anfrage(kurz));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await lauf).toMatchObject({ ok: false, fehler: { art: 'TimeoutError' } });
  });

  it('wartet bei 429 die Retry-After-Dauer ab (AK-9)', async () => {
    let anzahl = 0;
    mswServer.use(
      http.get(`${BASIS}/probe`, () => {
        anzahl += 1;
        return anzahl === 1
          ? new HttpResponse(null, { status: 429, headers: { 'Retry-After': '2' } })
          : HttpResponse.json({ a: 1 });
      }),
    );
    const lauf = clientMit().fuehreAus(anfrage());
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await lauf).toMatchObject({ ok: true });
    expect(anzahl).toBe(2);
  });

  it('bricht bei Retry-After ueber der Schwelle sofort ab (AK-9)', async () => {
    let anzahl = 0;
    mswServer.use(
      http.get(`${BASIS}/probe`, () => {
        anzahl += 1;
        return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '120' } });
      }),
    );
    const ergebnis = await clientMit().fuehreAus(anfrage());
    expect(anzahl).toBe(1);
    expect(ergebnis).toMatchObject({
      ok: false,
      fehler: { art: 'RateLimitError', wiederholbarNachSek: 120 },
    });
  });

  it('meldet unlesbaren JSON-Rumpf bei 200 als ContractViolation', async () => {
    mswServer.use(
      http.get(`${BASIS}/probe`, () => new HttpResponse('kein json', { status: 200 })),
    );
    expect(await clientMit().fuehreAus(anfrage())).toMatchObject({
      ok: false,
      fehler: { art: 'ContractViolation' },
    });
  });

  it('haelt das Gesamtbudget je Schritt ein', async () => {
    const knapp = testKonfiguration({
      gesamtbudgetMs: 400,
      retry: { ...testKonfiguration().retry, jitter: 'keiner' },
    });
    mswServer.use(http.get(`${BASIS}/probe`, () => new HttpResponse(null, { status: 503 })));
    const lauf = clientMit(knapp).fuehreAus(anfrage(knapp));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await lauf).toMatchObject({ ok: false, fehler: { art: 'TimeoutError' } });
  });

  it('haelt keine Zahlenkonstante fuer Timeout, Backoff oder Versuchszahl (AK-7, G-4)', () => {
    const quelle = readFileSync(
      fileURLToPath(new URL('../src/client/http-client.ts', import.meta.url)),
      'utf8',
    );
    // Zulaessig sind ausschliesslich HTTP-Statuscodes und Zahlen ohne Zeitbezug.
    const verdaechtig = quelle.match(/\b\d{3,}(?:_\d{3})*\b/g) ?? [];
    expect(
      verdaechtig.filter((z) => !['200', '300', '401', '403', '404', '429', '500'].includes(z)),
    ).toEqual([]);
  });
});
